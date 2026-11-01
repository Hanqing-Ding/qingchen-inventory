-- 商品档案：季节筛选字段 + 多样图
alter table public.products
  add column if not exists image_urls text[] not null default '{}';

alter table public.products
  add column if not exists season text not null default '四季';

create index if not exists idx_products_season on public.products (season);
create index if not exists idx_products_brand_season on public.products (brand, season);

comment on column public.products.image_urls is '款式样图 URL 列表；image_url 为封面兼容字段';
comment on column public.products.season is '季节：春夏 / 秋冬';
