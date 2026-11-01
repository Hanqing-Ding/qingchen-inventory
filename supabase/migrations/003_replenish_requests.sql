-- =============================================================================
-- 增量迁移 003：每日补货需求 + 拣货完成后一键生成出库单
-- 前置：已执行 schema.sql；建议已执行 002（店铺扩展 + quick_inbound）
-- =============================================================================

-- 单号类型扩展：补货需求 RQ
-- next_doc_no 已支持自定义前缀逻辑，此处补 'replenish' 分支

create or replace function public.next_doc_no(p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Shanghai')::date;
  v_seq integer;
  v_prefix text;
begin
  if p_doc_type = 'inbound' then
    v_prefix := 'IN';
  elsif p_doc_type = 'shipment' then
    v_prefix := 'SH';
  elsif p_doc_type = 'stocktake' then
    v_prefix := 'ST';
  elsif p_doc_type = 'replenish' then
    v_prefix := 'RQ';
  else
    raise exception '未知单据类型: %', p_doc_type;
  end if;

  insert into public.doc_sequences (doc_type, day, last_seq)
  values (p_doc_type, v_day, 1)
  on conflict (doc_type, day)
  do update set last_seq = public.doc_sequences.last_seq + 1
  returning last_seq into v_seq;

  return v_prefix
    || to_char(v_day, 'YYYYMMDD')
    || lpad(v_seq::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 补货需求单头（跟单每日录入；仓拣可见）
-- status: open=待拣货 / shipped=已生成出库 / cancelled=作废
-- ---------------------------------------------------------------------------
create table if not exists public.replenish_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  shop_id uuid not null references public.shops (id),
  request_date date not null default ((now() at time zone 'Asia/Shanghai')::date),
  status text not null default 'open'
    check (status in ('open', 'shipped', 'cancelled')),
  remark text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  shipped_at timestamptz,
  shipment_order_id uuid references public.shipment_orders (id)
);

create index if not exists idx_replenish_date on public.replenish_requests (request_date desc);
create index if not exists idx_replenish_status on public.replenish_requests (status);
create index if not exists idx_replenish_shop on public.replenish_requests (shop_id);

create table if not exists public.replenish_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.replenish_requests (id) on delete cascade,
  product_sku_id uuid not null references public.product_skus (id),
  style_no text not null,
  color text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  unique (request_id, product_sku_id)
);

create index if not exists idx_replenish_items_req on public.replenish_request_items (request_id);

alter table public.replenish_requests enable row level security;
alter table public.replenish_request_items enable row level security;

drop policy if exists replenish_select on public.replenish_requests;
drop policy if exists replenish_insert on public.replenish_requests;
drop policy if exists replenish_update on public.replenish_requests;
drop policy if exists replenish_items_select on public.replenish_request_items;
drop policy if exists replenish_items_write on public.replenish_request_items;

create policy replenish_select on public.replenish_requests for select to authenticated
  using (public.can_operate_stock());

create policy replenish_insert on public.replenish_requests for insert to authenticated
  with check (public.can_operate_stock() and created_by = auth.uid());

create policy replenish_update on public.replenish_requests for update to authenticated
  using (public.can_operate_stock())
  with check (public.can_operate_stock());

create policy replenish_items_select on public.replenish_request_items for select to authenticated
  using (public.can_operate_stock());

-- 仅 open 状态可改明细
create policy replenish_items_write on public.replenish_request_items for all to authenticated
  using (
    public.can_operate_stock()
    and exists (
      select 1 from public.replenish_requests r
      where r.id = request_id and r.status = 'open'
    )
  )
  with check (public.can_operate_stock());

-- ---------------------------------------------------------------------------
-- 创建补货需求单（空单头）
-- ---------------------------------------------------------------------------
create or replace function public.create_replenish_request(
  p_shop_id uuid,
  p_request_date date default null,
  p_remark text default null
)
returns public.replenish_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.replenish_requests;
begin
  if not public.can_operate_stock() then
    raise exception '无权限创建补货需求';
  end if;

  insert into public.replenish_requests (
    request_no, shop_id, request_date, remark, created_by
  ) values (
    public.next_doc_no('replenish'),
    p_shop_id,
    coalesce(p_request_date, (now() at time zone 'Asia/Shanghai')::date),
    p_remark,
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 向需求单追加一行：按款号+颜色+尺码解析/补建 SKU
-- ---------------------------------------------------------------------------
create or replace function public.add_replenish_item(
  p_request_id uuid,
  p_style_no text,
  p_color text,
  p_size text,
  p_quantity integer
)
returns public.replenish_request_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.replenish_requests;
  v_product public.products;
  v_sku_id uuid;
  v_size text;
  v_item public.replenish_request_items;
begin
  if not public.can_operate_stock() then
    raise exception '无权限录入补货需求';
  end if;

  select * into v_req from public.replenish_requests where id = p_request_id for update;
  if not found then
    raise exception '补货需求单不存在';
  end if;
  if v_req.status <> 'open' then
    raise exception '需求单已出库或作废，不可再改明细';
  end if;

  if p_style_no is null or btrim(p_style_no) = '' then
    raise exception '请填写款号';
  end if;
  if p_color is null or btrim(p_color) = '' then
    raise exception '请填写颜色';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '数量须为正整数';
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
    raise exception '未找到款号「%」，请先建档', btrim(p_style_no);
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

  insert into public.replenish_request_items (
    request_id, product_sku_id, style_no, color, size, quantity
  ) values (
    p_request_id, v_sku_id, v_product.style_no, btrim(p_color), v_size, p_quantity
  )
  on conflict (request_id, product_sku_id)
  do update set quantity = public.replenish_request_items.quantity + excluded.quantity
  returning * into v_item;

  return v_item;
end;
$$;

-- ---------------------------------------------------------------------------
-- 仓拣完成后：一键生成出库单并扣减库存（禁止负库存）
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_replenish_request(p_request_id uuid)
returns public.shipment_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.replenish_requests;
  v_ship public.shipment_orders;
  v_item record;
begin
  if not public.can_operate_stock() then
    raise exception '无权限生成出库单';
  end if;

  select * into v_req
  from public.replenish_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception '补货需求单不存在';
  end if;
  if v_req.status = 'shipped' then
    raise exception '该需求已生成出库单，不可重复操作';
  end if;
  if v_req.status = 'cancelled' then
    raise exception '需求单已作废';
  end if;

  if not exists (
    select 1 from public.replenish_request_items where request_id = p_request_id
  ) then
    raise exception '需求单无明细，无法出库';
  end if;

  insert into public.shipment_orders (order_no, shop_id, remark, created_by)
  values (
    public.next_doc_no('shipment'),
    v_req.shop_id,
    coalesce('由补货需求 ' || v_req.request_no || ' 生成', v_req.remark),
    auth.uid()
  )
  returning * into v_ship;

  for v_item in
    select * from public.replenish_request_items where request_id = p_request_id
  loop
    insert into public.shipment_order_items (
      shipment_order_id, product_sku_id, quantity
    ) values (
      v_ship.id, v_item.product_sku_id, v_item.quantity
    );
  end loop;

  -- 提交出库：扣库存 + 写流水（库存不足会整单回滚）
  v_ship := public.submit_shipment_order(v_ship.id);

  update public.replenish_requests
  set status = 'shipped',
      shipped_at = now(),
      shipment_order_id = v_ship.id
  where id = p_request_id;

  return v_ship;
end;
$$;

-- 作废未出库需求
create or replace function public.cancel_replenish_request(p_request_id uuid)
returns public.replenish_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.replenish_requests;
begin
  if not public.can_operate_stock() then
    raise exception '无权限作废';
  end if;

  update public.replenish_requests
  set status = 'cancelled'
  where id = p_request_id
    and status = 'open'
  returning * into v_row;

  if not found then
    raise exception '仅待拣货的需求单可作废';
  end if;

  return v_row;
end;
$$;

grant execute on function public.create_replenish_request(uuid, date, text) to authenticated;
grant execute on function public.add_replenish_item(uuid, text, text, text, integer) to authenticated;
grant execute on function public.fulfill_replenish_request(uuid) to authenticated;
grant execute on function public.cancel_replenish_request(uuid) to authenticated;
