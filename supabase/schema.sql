-- =============================================================================
-- 青陈时尚 · 服装出入库系统 — Supabase 完整建表脚本
-- 用法：在 Supabase Dashboard → SQL Editor 中整份执行
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 扩展
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 辅助：更新 updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 辅助：当前用户角色
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_operate_stock()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'warehouse', 'merchandiser')
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles（与 auth.users 一对一）
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'merchandiser'
    check (role in ('admin', 'warehouse', 'merchandiser')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 新用户注册时自动建 profile（默认跟单；管理员请事后改 role）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), '用户'),
    coalesce(new.raw_user_meta_data->>'role', 'merchandiser')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- shops（多店铺扩展）
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  -- 合作零售方信息（补货发货去向）
  contact_name text,
  phone text,
  address text,
  remark text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products（款级档案）
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  style_no text not null unique,
  name text not null,
  image_url text,
  -- 多图样册（封面仍写 image_url = image_urls[1]）
  image_urls text[] not null default '{}',
  composition text,
  category text not null,
  -- 季节筛选：春夏 / 秋冬
  season text not null default '春夏',
  retail_price numeric(12, 2) not null default 0
    check (retail_price >= 0),
  -- 扫码扩展预留（款级条码）
  barcode text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_brand on public.products (brand);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_brand_category on public.products (brand, category);
create index if not exists idx_products_barcode on public.products (barcode) where barcode is not null;

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_skus（款号+颜色+尺码 = 库存唯一单元）
-- ---------------------------------------------------------------------------
create table if not exists public.product_skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  color text not null,
  size text not null,
  quantity integer not null default 0
    check (quantity >= 0),
  -- 扫码扩展预留（SKU 级条码）
  sku_barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color, size)
);

create index if not exists idx_product_skus_product on public.product_skus (product_id);
create index if not exists idx_product_skus_barcode on public.product_skus (sku_barcode)
  where sku_barcode is not null;

create trigger trg_product_skus_updated_at
  before update on public.product_skus
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inbound_orders / items
-- ---------------------------------------------------------------------------
create table if not exists public.inbound_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  remark text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  created_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.inbound_order_items (
  id uuid primary key default gen_random_uuid(),
  inbound_order_id uuid not null references public.inbound_orders (id) on delete cascade,
  product_sku_id uuid not null references public.product_skus (id),
  quantity integer not null check (quantity > 0),
  unique (inbound_order_id, product_sku_id)
);

create index if not exists idx_inbound_items_order on public.inbound_order_items (inbound_order_id);

-- ---------------------------------------------------------------------------
-- shipment_orders / items
-- ---------------------------------------------------------------------------
create table if not exists public.shipment_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  shop_id uuid not null references public.shops (id),
  remark text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  created_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipment_orders_shop on public.shipment_orders (shop_id);
create index if not exists idx_shipment_orders_created on public.shipment_orders (created_at desc);

create table if not exists public.shipment_order_items (
  id uuid primary key default gen_random_uuid(),
  shipment_order_id uuid not null references public.shipment_orders (id) on delete cascade,
  product_sku_id uuid not null references public.product_skus (id),
  quantity integer not null check (quantity > 0),
  unique (shipment_order_id, product_sku_id)
);

create index if not exists idx_shipment_items_order on public.shipment_order_items (shipment_order_id);

-- ---------------------------------------------------------------------------
-- stock_movements（库存变动流水）
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_sku_id uuid not null references public.product_skus (id),
  movement_type text not null
    check (movement_type in ('inbound', 'shipment', 'adjust')),
  quantity_delta integer not null,
  quantity_after integer not null check (quantity_after >= 0),
  ref_no text,
  shop_id uuid references public.shops (id),
  operator_id uuid references public.profiles (id),
  remark text,
  created_at timestamptz not null default now()
);

create index if not exists idx_movements_created on public.stock_movements (created_at desc);
create index if not exists idx_movements_ref_no on public.stock_movements (ref_no);
create index if not exists idx_movements_sku on public.stock_movements (product_sku_id);
create index if not exists idx_movements_shop on public.stock_movements (shop_id);
create index if not exists idx_movements_operator on public.stock_movements (operator_id);
create index if not exists idx_movements_type on public.stock_movements (movement_type);

-- ---------------------------------------------------------------------------
-- 盘点扩展预留（表结构就绪，业务可后续开启）
-- ---------------------------------------------------------------------------
create table if not exists public.stocktake_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  remark text,
  created_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.stocktake_order_items (
  id uuid primary key default gen_random_uuid(),
  stocktake_order_id uuid not null references public.stocktake_orders (id) on delete cascade,
  product_sku_id uuid not null references public.product_skus (id),
  book_quantity integer not null check (book_quantity >= 0),
  counted_quantity integer not null check (counted_quantity >= 0),
  unique (stocktake_order_id, product_sku_id)
);

-- ---------------------------------------------------------------------------
-- 单号生成：IN/SH/ST + YYYYMMDD + 4 位序号
-- ---------------------------------------------------------------------------
create table if not exists public.doc_sequences (
  doc_type text not null,
  day date not null,
  last_seq integer not null default 0,
  primary key (doc_type, day)
);

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
-- 提交入库：增加库存 + 写流水（原子）
-- ---------------------------------------------------------------------------
create or replace function public.submit_inbound_order(p_order_id uuid)
returns public.inbound_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.inbound_orders;
  v_item record;
  v_new_qty integer;
begin
  if not public.can_operate_stock() then
    raise exception '无权限提交入库单';
  end if;

  select * into v_order
  from public.inbound_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception '入库单不存在';
  end if;
  if v_order.status <> 'draft' then
    raise exception '入库单已提交，不可重复提交';
  end if;

  if not exists (
    select 1 from public.inbound_order_items where inbound_order_id = p_order_id
  ) then
    raise exception '入库单无明细';
  end if;

  for v_item in
    select * from public.inbound_order_items where inbound_order_id = p_order_id
  loop
    update public.product_skus
    set quantity = quantity + v_item.quantity
    where id = v_item.product_sku_id
    returning quantity into v_new_qty;

    if not found then
      raise exception 'SKU 不存在: %', v_item.product_sku_id;
    end if;

    insert into public.stock_movements (
      product_sku_id, movement_type, quantity_delta, quantity_after,
      ref_no, shop_id, operator_id, remark
    ) values (
      v_item.product_sku_id, 'inbound', v_item.quantity, v_new_qty,
      v_order.order_no, null, auth.uid(), v_order.remark
    );
  end loop;

  update public.inbound_orders
  set status = 'submitted',
      submitted_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- 提交发货：扣减库存（禁止负库存）+ 写流水（原子）
-- ---------------------------------------------------------------------------
create or replace function public.submit_shipment_order(p_order_id uuid)
returns public.shipment_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shipment_orders;
  v_item record;
  v_new_qty integer;
  v_style text;
  v_color text;
  v_size text;
begin
  if not public.can_operate_stock() then
    raise exception '无权限提交发货单';
  end if;

  select * into v_order
  from public.shipment_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception '发货单不存在';
  end if;
  if v_order.status <> 'draft' then
    raise exception '发货单已提交，不可重复提交';
  end if;

  if not exists (
    select 1 from public.shipment_order_items where shipment_order_id = p_order_id
  ) then
    raise exception '发货单无明细';
  end if;

  for v_item in
    select * from public.shipment_order_items where shipment_order_id = p_order_id
  loop
    update public.product_skus
    set quantity = quantity - v_item.quantity
    where id = v_item.product_sku_id
      and quantity >= v_item.quantity
    returning quantity into v_new_qty;

    if not found then
      select p.style_no, s.color, s.size
      into v_style, v_color, v_size
      from public.product_skus s
      join public.products p on p.id = s.product_id
      where s.id = v_item.product_sku_id;

      raise exception '库存不足，禁止负库存：款号 % 颜色 % 尺码 %，需求 %',
        coalesce(v_style, '?'), coalesce(v_color, '?'), coalesce(v_size, '?'),
        v_item.quantity;
    end if;

    insert into public.stock_movements (
      product_sku_id, movement_type, quantity_delta, quantity_after,
      ref_no, shop_id, operator_id, remark
    ) values (
      v_item.product_sku_id, 'shipment', -v_item.quantity, v_new_qty,
      v_order.order_no, v_order.shop_id, auth.uid(), v_order.remark
    );
  end loop;

  update public.shipment_orders
  set status = 'submitted',
      submitted_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- 便捷：创建草稿入库单（含单号）
-- ---------------------------------------------------------------------------
create or replace function public.create_inbound_order(p_remark text default null)
returns public.inbound_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inbound_orders;
begin
  if not public.can_operate_stock() then
    raise exception '无权限创建入库单';
  end if;

  insert into public.inbound_orders (order_no, remark, created_by)
  values (public.next_doc_no('inbound'), p_remark, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.create_shipment_order(
  p_shop_id uuid,
  p_remark text default null
)
returns public.shipment_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shipment_orders;
begin
  if not public.can_operate_stock() then
    raise exception '无权限创建发货单';
  end if;

  insert into public.shipment_orders (order_no, shop_id, remark, created_by)
  values (public.next_doc_no('shipment'), p_shop_id, p_remark, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 快捷入库：款号 + 颜色 + 尺码 + 数量（尺码空则默认「均码」）
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

-- ---------------------------------------------------------------------------
-- 库存总览视图（便于查询/导出）
-- ---------------------------------------------------------------------------
create or replace view public.v_inventory as
select
  s.id as sku_id,
  p.id as product_id,
  p.brand,
  p.style_no,
  p.name as product_name,
  p.category,
  p.retail_price,
  p.image_url,
  p.is_active,
  s.color,
  s.size,
  s.quantity,
  s.sku_barcode,
  p.barcode as product_barcode
from public.product_skus s
join public.products p on p.id = s.product_id;

create or replace view public.v_stock_movements as
select
  m.id,
  m.created_at,
  m.movement_type,
  m.quantity_delta,
  m.quantity_after,
  m.ref_no,
  m.remark,
  m.shop_id,
  sh.name as shop_name,
  sh.code as shop_code,
  m.operator_id,
  pr.display_name as operator_name,
  s.id as sku_id,
  s.color,
  s.size,
  p.style_no,
  p.brand,
  p.name as product_name,
  p.category
from public.stock_movements m
join public.product_skus s on s.id = m.product_sku_id
join public.products p on p.id = s.product_id
left join public.shops sh on sh.id = m.shop_id
left join public.profiles pr on pr.id = m.operator_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.product_skus enable row level security;
alter table public.inbound_orders enable row level security;
alter table public.inbound_order_items enable row level security;
alter table public.shipment_orders enable row level security;
alter table public.shipment_order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stocktake_orders enable row level security;
alter table public.stocktake_order_items enable row level security;
alter table public.doc_sequences enable row level security;

-- profiles
create policy profiles_select_authenticated
  on public.profiles for select to authenticated
  using (true);

create policy profiles_update_self_name
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()))
  );

-- shops：登录可读；仓管/跟单/管理员可维护合作店铺（补货去向）
create policy shops_select on public.shops for select to authenticated using (true);
create policy shops_write_operators on public.shops for all to authenticated
  using (public.can_operate_stock()) with check (public.can_operate_stock());

-- products：登录可读；仅管理员写档案/改价
create policy products_select on public.products for select to authenticated using (true);
create policy products_admin_insert on public.products for insert to authenticated
  with check (public.is_admin());
create policy products_admin_update on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy products_admin_delete on public.products for delete to authenticated
  using (public.is_admin());

-- product_skus：登录可读；档案级增删改仅管理员
-- 库存数量变更由 security definer 函数执行，绕过直接 update 策略限制
create policy skus_select on public.product_skus for select to authenticated using (true);
create policy skus_admin_insert on public.product_skus for insert to authenticated
  with check (public.is_admin());
create policy skus_admin_update on public.product_skus for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy skus_admin_delete on public.product_skus for delete to authenticated
  using (public.is_admin());

-- 入库单
create policy inbound_select on public.inbound_orders for select to authenticated
  using (public.can_operate_stock());
create policy inbound_insert on public.inbound_orders for insert to authenticated
  with check (public.can_operate_stock() and created_by = auth.uid());
create policy inbound_update_draft on public.inbound_orders for update to authenticated
  using (public.can_operate_stock() and status = 'draft')
  with check (public.can_operate_stock());

create policy inbound_items_select on public.inbound_order_items for select to authenticated
  using (public.can_operate_stock());
create policy inbound_items_write on public.inbound_order_items for all to authenticated
  using (
    public.can_operate_stock()
    and exists (
      select 1 from public.inbound_orders o
      where o.id = inbound_order_id and o.status = 'draft'
    )
  )
  with check (public.can_operate_stock());

-- 发货单
create policy shipment_select on public.shipment_orders for select to authenticated
  using (public.can_operate_stock());
create policy shipment_insert on public.shipment_orders for insert to authenticated
  with check (public.can_operate_stock() and created_by = auth.uid());
create policy shipment_update_draft on public.shipment_orders for update to authenticated
  using (public.can_operate_stock() and status = 'draft')
  with check (public.can_operate_stock());

create policy shipment_items_select on public.shipment_order_items for select to authenticated
  using (public.can_operate_stock());
create policy shipment_items_write on public.shipment_order_items for all to authenticated
  using (
    public.can_operate_stock()
    and exists (
      select 1 from public.shipment_orders o
      where o.id = shipment_order_id and o.status = 'draft'
    )
  )
  with check (public.can_operate_stock());

-- 流水：全员可查（仓管/跟单/管理员）；禁止直接插入（由函数写入）
create policy movements_select on public.stock_movements for select to authenticated
  using (public.can_operate_stock());

-- 盘点预留：仅管理员
create policy stocktake_admin on public.stocktake_orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy stocktake_items_admin on public.stocktake_order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 序号表：禁止客户端直接访问（函数 security definer）
create policy doc_seq_deny on public.doc_sequences for all to authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Storage：款式图 bucket（若已存在可忽略报错后继续）
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy product_images_public_read
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy product_images_auth_upload
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_update
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 种子：默认店铺
-- ---------------------------------------------------------------------------
insert into public.shops (code, name)
values ('DEFAULT', '默认店')
on conflict (code) do nothing;

-- =============================================================================
-- 种子角色说明（手动步骤，勿在无用户时盲目执行）
-- -----------------------------------------------------------------------------
-- 1. 在 Authentication → Users 创建管理员账号（邮箱+密码）
-- 2. 执行下方 SQL，将邮箱替换为实际管理员邮箱：
--
--    update public.profiles
--    set role = 'admin', display_name = '管理员'
--    where id = (
--      select id from auth.users where email = 'admin@example.com'
--    );
--
-- 3. 仓管 / 跟单同理，将 role 设为 'warehouse' 或 'merchandiser'
-- 4. 也可在邀请用户时于 raw_user_meta_data 传入 {"role":"warehouse","display_name":"仓管张三"}
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 补货需求（跟单录入 / 仓拣一键出库）— 与 migration-003 一致
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


grant usage on schema public to authenticated;
grant select on public.v_inventory to authenticated;
grant select on public.v_stock_movements to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_operate_stock() to authenticated;
grant execute on function public.next_doc_no(text) to authenticated;
grant execute on function public.create_inbound_order(text) to authenticated;
grant execute on function public.create_shipment_order(uuid, text) to authenticated;
grant execute on function public.submit_inbound_order(uuid) to authenticated;
grant execute on function public.submit_shipment_order(uuid) to authenticated;
grant execute on function public.quick_inbound(text, text, text, integer, text) to authenticated;
grant execute on function public.create_replenish_request(uuid, date, text) to authenticated;
grant execute on function public.add_replenish_item(uuid, text, text, text, integer) to authenticated;
grant execute on function public.fulfill_replenish_request(uuid) to authenticated;
grant execute on function public.cancel_replenish_request(uuid) to authenticated;

