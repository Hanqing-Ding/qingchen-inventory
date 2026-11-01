-- 合作店铺档案 + stock_out.shop_id
-- 不改动 clothing_styles / skus / stock_in 库存逻辑，不改动三个出入库 RPC

create table if not exists public.shops (
  shop_code text primary key,
  shop_name text not null,
  type text not null
    check (type in ('独立店铺', '下属门店')),
  parent_shop_id text references public.shops (shop_code),
  contact_person text,
  phone text,
  address text,
  remark text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shops_branch_needs_parent check (
    (type = '下属门店' and parent_shop_id is not null)
    or (type = '独立店铺' and parent_shop_id is null)
  )
);

comment on table public.shops is '合作店铺档案；下属门店绑定父店后发货地址取父店';
comment on column public.shops.deleted_at is '软归档时间；有关联出库单时禁止物理删除';

create index if not exists idx_shops_parent on public.shops (parent_shop_id);
create index if not exists idx_shops_deleted_at on public.shops (deleted_at)
  where deleted_at is not null;

alter table public.stock_out
  add column if not exists shop_id text references public.shops (shop_code);

comment on column public.stock_out.shop_id is '关联 shops.shop_code；customer 仍存店铺名称兼容旧数据';

create index if not exists idx_stock_out_shop_id on public.stock_out (shop_id);

alter table public.shops enable row level security;

drop policy if exists shops_select on public.shops;
drop policy if exists shops_insert on public.shops;
drop policy if exists shops_update on public.shops;
drop policy if exists shops_delete on public.shops;

create policy shops_select on public.shops for select using (true);
create policy shops_insert on public.shops for insert with check (true);
create policy shops_update on public.shops for update using (true) with check (true);
create policy shops_delete on public.shops for delete using (true);

grant select, insert, update, delete on public.shops to anon, authenticated, service_role;
