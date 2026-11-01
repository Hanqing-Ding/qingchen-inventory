-- SKU 软归档：有出入库流水时禁止物理删除，写入 deleted_at 隐藏
-- 不改动 quick_inbound / submit_stock_out / adjust_inventory

alter table public.skus
  add column if not exists deleted_at timestamptz;

comment on column public.skus.deleted_at is
  '软归档时间；非空表示已从库存总表默认视图隐藏，出入库流水保留';

create index if not exists idx_skus_deleted_at
  on public.skus (deleted_at)
  where deleted_at is not null;
