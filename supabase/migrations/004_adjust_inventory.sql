-- 库存总表手工调整：设为目标库存，写 adjust 流水，禁止负库存
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

  select quantity into v_before
  from public.product_skus
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
      'quantity_delta', 0,
      'ref_no', null
    );
  end if;

  update public.product_skus
  set quantity = v_after,
      updated_at = now()
  where id = p_sku_id;

  v_ref := 'ADJ' || to_char(now() at time zone 'Asia/Shanghai', 'YYYYMMDDHH24MISS')
    || substr(replace(p_sku_id::text, '-', ''), 1, 4);

  insert into public.stock_movements (
    product_sku_id, movement_type, quantity_delta, quantity_after,
    ref_no, remark, operator_id
  ) values (
    p_sku_id, 'adjust', v_delta, v_after,
    v_ref,
    coalesce(nullif(btrim(p_remark), ''), '库存总表手工调整'),
    auth.uid()
  );

  return jsonb_build_object(
    'sku_id', p_sku_id,
    'quantity_before', v_before,
    'quantity_after', v_after,
    'quantity_delta', v_delta,
    'ref_no', v_ref
  );
end;
$$;

grant execute on function public.adjust_inventory(uuid, integer, text) to authenticated;
