-- =============================================================================
-- 对齐已有四表：clothing_styles / skus / stock_in / stock_out
-- 在 Supabase SQL Editor 执行本文件，安装原子出入库 RPC。
-- 不创建 product_skus / stock_movements。
-- =============================================================================

create or replace function public.quick_inbound(
  p_style_no text,
  p_color text,
  p_size text,
  p_quantity integer,
  p_remark text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_style public.clothing_styles;
  v_sku public.skus;
  v_size text;
  v_batch text;
  v_new integer;
begin
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

  select * into v_style
  from public.clothing_styles
  where lower(style_no) = lower(btrim(p_style_no))
  limit 1;

  if not found then
    raise exception '未找到款号「%」，请先在商品档案中建档', btrim(p_style_no);
  end if;

  select * into v_sku
  from public.skus
  where style_id = v_style.id
    and color = btrim(p_color)
    and size = v_size
  for update;

  if not found then
    insert into public.skus (style_id, color, size, current_stock)
    values (v_style.id, btrim(p_color), v_size, 0)
    returning * into v_sku;
  end if;

  v_batch := 'IN'
    || to_char(now() at time zone 'Asia/Shanghai', 'YYYYMMDD')
    || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

  insert into public.stock_in (sku_id, quantity, batch_no, operator, remark)
  values (
    v_sku.id,
    p_quantity,
    v_batch,
    coalesce(auth.jwt() ->> 'email', auth.uid()::text),
    p_remark
  );

  update public.skus
  set current_stock = current_stock + p_quantity
  where id = v_sku.id
  returning current_stock into v_new;

  return jsonb_build_object(
    'order_no', v_batch,
    'batch_no', v_batch,
    'sku_id', v_sku.id,
    'quantity', p_quantity,
    'current_stock', v_new
  );
end;
$$;

create or replace function public.submit_stock_out(
  p_customer text,
  p_remark text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order text;
  v_line jsonb;
  v_sku public.skus;
  v_qty integer;
  v_sku_id uuid;
  v_style_no text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception '请至少添加一行出库明细';
  end if;

  v_order := 'SH'
    || to_char(now() at time zone 'Asia/Shanghai', 'YYYYMMDD')
    || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sku_id := (v_line ->> 'sku_id')::uuid;
    v_qty := (v_line ->> 'quantity')::integer;
    if v_sku_id is null or v_qty is null or v_qty <= 0 then
      raise exception '出库明细无效';
    end if;

    select * into v_sku from public.skus where id = v_sku_id for update;
    if not found then
      raise exception 'SKU 不存在: %', v_sku_id;
    end if;

    if v_sku.current_stock < v_qty then
      select style_no into v_style_no
      from public.clothing_styles
      where id = v_sku.style_id;
      raise exception '库存不足，禁止负库存：款号 % 颜色 % 尺码 %，需求 %',
        coalesce(v_style_no, '?'), v_sku.color, v_sku.size, v_qty;
    end if;

    insert into public.stock_out (
      sku_id, quantity, order_no, customer, operator, remark
    ) values (
      v_sku_id,
      v_qty,
      v_order,
      nullif(btrim(coalesce(p_customer, '')), ''),
      coalesce(auth.jwt() ->> 'email', auth.uid()::text),
      p_remark
    );

    update public.skus
    set current_stock = current_stock - v_qty
    where id = v_sku_id
      and current_stock >= v_qty;

    if not found then
      raise exception '库存不足，禁止负库存';
    end if;
  end loop;

  return jsonb_build_object('id', v_order, 'order_no', v_order);
end;
$$;

create or replace function public.adjust_inventory(
  p_sku_id uuid,
  p_quantity integer,
  p_remark text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_after integer;
  v_delta integer;
  v_ref text;
begin
  if p_sku_id is null then
    raise exception '缺少 SKU';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception '库存须为非负整数';
  end if;

  select current_stock into v_before
  from public.skus
  where id = p_sku_id
  for update;

  if not found then
    raise exception 'SKU 不存在';
  end if;

  v_after := p_quantity;
  v_delta := v_after - v_before;
  if v_delta = 0 then
    return jsonb_build_object(
      'sku_id', p_sku_id,
      'quantity_before', v_before,
      'quantity_after', v_after,
      'quantity_delta', 0
    );
  end if;

  v_ref := 'ADJ'
    || to_char(now() at time zone 'Asia/Shanghai', 'YYYYMMDDHH24MISS');

  if v_delta > 0 then
    insert into public.stock_in (sku_id, quantity, batch_no, operator, remark)
    values (
      p_sku_id, v_delta, v_ref,
      coalesce(auth.jwt() ->> 'email', auth.uid()::text),
      coalesce(nullif(btrim(p_remark), ''), '库存总表手工调整')
    );
  else
    insert into public.stock_out (
      sku_id, quantity, order_no, customer, operator, remark
    ) values (
      p_sku_id, abs(v_delta), v_ref, '库存调整',
      coalesce(auth.jwt() ->> 'email', auth.uid()::text),
      coalesce(nullif(btrim(p_remark), ''), '库存总表手工调整')
    );
  end if;

  update public.skus
  set current_stock = v_after
  where id = p_sku_id;

  return jsonb_build_object(
    'sku_id', p_sku_id,
    'quantity_before', v_before,
    'quantity_after', v_after,
    'quantity_delta', v_delta,
    'ref_no', v_ref
  );
end;
$$;

grant execute on function public.quick_inbound(text, text, text, integer, text) to authenticated, anon;
grant execute on function public.submit_stock_out(text, text, jsonb) to authenticated, anon;
grant execute on function public.adjust_inventory(uuid, integer, text) to authenticated, anon;
