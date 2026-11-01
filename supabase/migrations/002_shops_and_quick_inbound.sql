-- =============================================================================
-- 增量迁移：合作店铺信息完善 + 快捷入库函数
-- 在 Supabase SQL Editor 执行（已跑过完整 schema.sql 的项目）
-- =============================================================================

-- 合作零售店铺扩展字段
alter table public.shops
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists remark text;

comment on column public.shops.contact_name is '对接人';
comment on column public.shops.phone is '联系电话';
comment on column public.shops.address is '收货/门店地址';
comment on column public.shops.remark is '备注（合作说明等）';

-- 仓管/跟单也可维护合作店铺（补货去向）
drop policy if exists shops_admin_write on public.shops;
create policy shops_write_operators on public.shops for all to authenticated
  using (public.can_operate_stock())
  with check (public.can_operate_stock());

-- ---------------------------------------------------------------------------
-- 快捷入库：款号 + 颜色 + 尺码 + 数量 → 自动匹配/补建 SKU 并提交入库
-- 尺码可传空，默认「均码」
-- ---------------------------------------------------------------------------
create or replace function public.quick_inbound(
  p_style_no text,
  p_color text,
  p_size text,
  p_quantity integer,
  p_remark text default null
)
returns public.inbound_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_sku_id uuid;
  v_size text;
  v_order public.inbound_orders;
begin
  if not public.can_operate_stock() then
    raise exception '无权限入库';
  end if;

  if p_style_no is null or btrim(p_style_no) = '' then
    raise exception '请填写款号';
  end if;
  if p_color is null or btrim(p_color) = '' then
    raise exception '请填写颜色';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '入库数量须为正整数';
  end if;

  v_size := nullif(btrim(coalesce(p_size, '')), '');
  if v_size is null then
    v_size := '均码';
  end if;

  select * into v_product
  from public.products
  where lower(style_no) = lower(btrim(p_style_no))
    and is_active = true
  limit 1;

  if not found then
    raise exception '未找到款号「%」，请先在商品档案中建档', btrim(p_style_no);
  end if;

  select id into v_sku_id
  from public.product_skus
  where product_id = v_product.id
    and color = btrim(p_color)
    and size = v_size;

  if v_sku_id is null then
    insert into public.product_skus (product_id, color, size, quantity)
    values (v_product.id, btrim(p_color), v_size, 0)
    returning id into v_sku_id;
  end if;

  insert into public.inbound_orders (order_no, remark, created_by)
  values (public.next_doc_no('inbound'), p_remark, auth.uid())
  returning * into v_order;

  insert into public.inbound_order_items (inbound_order_id, product_sku_id, quantity)
  values (v_order.id, v_sku_id, p_quantity);

  return public.submit_inbound_order(v_order.id);
end;
$$;

grant execute on function public.quick_inbound(text, text, text, integer, text) to authenticated;
