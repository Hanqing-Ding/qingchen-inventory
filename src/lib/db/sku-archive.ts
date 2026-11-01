/**
 * SKU 批量删除 / 软归档 / 恢复。
 * - 有 stock_in 或 stock_out 流水 → 写 deleted_at（软归档），保留流水
 * - 无流水 → 物理删除
 * 不改动 quick_inbound / submit_stock_out / adjust_inventory。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SkuArchiveItem = {
  sku_id: string;
  style_no: string;
  color: string;
  size: string;
};

export type BatchDeleteArchiveResult = {
  archived: number;
  deleted: number;
  archivedItems: SkuArchiveItem[];
  deletedItems: SkuArchiveItem[];
};

async function skuHasMovements(
  supabase: SupabaseClient,
  skuId: string,
): Promise<boolean> {
  const [inRes, outRes] = await Promise.all([
    supabase
      .from("stock_in")
      .select("id", { count: "exact", head: true })
      .eq("sku_id", skuId),
    supabase
      .from("stock_out")
      .select("id", { count: "exact", head: true })
      .eq("sku_id", skuId),
  ]);
  if (inRes.error) throw inRes.error;
  if (outRes.error) throw outRes.error;
  return (inRes.count ?? 0) > 0 || (outRes.count ?? 0) > 0;
}

/** 逐条处理：有流水归档，无流水物理删除 */
export async function batchDeleteOrArchiveSkus(
  supabase: SupabaseClient,
  items: SkuArchiveItem[],
): Promise<BatchDeleteArchiveResult> {
  const archivedItems: SkuArchiveItem[] = [];
  const deletedItems: SkuArchiveItem[] = [];
  const now = new Date().toISOString();

  for (const item of items) {
    const hasMovements = await skuHasMovements(supabase, item.sku_id);
    if (hasMovements) {
      const { error } = await supabase
        .from("skus")
        .update({ deleted_at: now })
        .eq("id", item.sku_id)
        .is("deleted_at", null);
      if (error) throw error;
      archivedItems.push(item);
    } else {
      const { error } = await supabase.from("skus").delete().eq("id", item.sku_id);
      if (error) throw error;
      deletedItems.push(item);
    }
  }

  return {
    archived: archivedItems.length,
    deleted: deletedItems.length,
    archivedItems,
    deletedItems,
  };
}

/** 批量恢复：清空 deleted_at */
export async function batchRestoreSkus(
  supabase: SupabaseClient,
  skuIds: string[],
): Promise<{ restored: number }> {
  if (!skuIds.length) return { restored: 0 };
  const { data, error } = await supabase
    .from("skus")
    .update({ deleted_at: null })
    .in("id", skuIds)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) throw error;
  return { restored: data?.length ?? 0 };
}

export function formatDeleteArchiveSummary(result: BatchDeleteArchiveResult): string {
  return `${result.archived}个SKU已有出入库流水，已归档隐藏；${result.deleted}个SKU无流水，已直接删除`;
}
