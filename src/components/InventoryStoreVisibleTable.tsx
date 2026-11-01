"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InventoryRow } from "@/types/database";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import { InventoryQtyEditor } from "@/components/InventoryQtyEditor";
import { Alert, Button } from "@/components/ui";
import {
  batchDeleteOrArchiveSkus,
  batchRestoreSkus,
  formatDeleteArchiveSummary,
  type SkuArchiveItem,
} from "@/lib/db/sku-archive";

type Props = {
  rows: InventoryRow[];
  canStock: boolean;
  canMaster: boolean;
  /** 当前是否在「显示已归档」视图 */
  showArchived: boolean;
};

type ConfirmMode = "delete" | "restore" | null;

/** 库存总表：SKU 复选 + 批量可见 / 删除归档 / 恢复 */
export function InventoryStoreVisibleTable({
  rows,
  canStock,
  canMaster,
  showArchived,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.sku_id)),
    [rows, selected],
  );

  function toggleSku(skuId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skuId)) next.delete(skuId);
      else next.add(skuId);
      return next;
    });
  }

  function toggleAllSkus() {
    const ids = rows.map((r) => r.sku_id);
    setSelected((prev) =>
      prev.size === ids.length && ids.length > 0 ? new Set() : new Set(ids),
    );
  }

  async function setVisible(productIds: string[], visible: boolean) {
    if (!canMaster || !productIds.length) return;
    if (!isMockPreview()) {
      setErr("对门店可见开关当前仅 Mock 预览可用");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await mockAction<{ updated: number }>("setStoreVisible", {
        productIds,
        visible,
      });
      setMsg(`已将 ${res.updated} 款设为${visible ? "对门店可见" : "对门店隐藏"}`);
      setSelected(new Set());
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "设置失败");
    } finally {
      setBusy(false);
    }
  }

  function productIdsFromSelection() {
    return Array.from(new Set(selectedRows.map((r) => r.product_id)));
  }

  function toArchiveItems(list: InventoryRow[]): SkuArchiveItem[] {
    return list.map((r) => ({
      sku_id: r.sku_id,
      style_no: r.style_no,
      color: r.color,
      size: r.size,
    }));
  }

  async function runDeleteOrArchive() {
    if (!canMaster || !selectedRows.length) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const items = toArchiveItems(selectedRows);
      let result;
      if (isMockPreview()) {
        result = await mockAction<{
          archived: number;
          deleted: number;
          archivedItems: SkuArchiveItem[];
          deletedItems: SkuArchiveItem[];
        }>("batchDeleteOrArchiveSkus", { items });
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        result = await batchDeleteOrArchiveSkus(createClient(), items);
      }
      setMsg(formatDeleteArchiveSummary(result));
      setSelected(new Set());
      setConfirmMode(null);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "删除/归档失败");
      setConfirmMode(null);
    } finally {
      setBusy(false);
    }
  }

  async function runRestore() {
    if (!canMaster || !selectedRows.length) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const skuIds = selectedRows.map((r) => r.sku_id);
      let restored: number;
      if (isMockPreview()) {
        const res = await mockAction<{ restored: number }>("batchRestoreSkus", {
          skuIds,
        });
        restored = res.restored;
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const res = await batchRestoreSkus(createClient(), skuIds);
        restored = res.restored;
      }
      setMsg(`已恢复 ${restored} 个归档 SKU`);
      setSelected(new Set());
      setConfirmMode(null);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "恢复失败");
      setConfirmMode(null);
    } finally {
      setBusy(false);
    }
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="space-y-3">
      {canMaster ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button type="button" variant="secondary" onClick={toggleAllSkus} disabled={busy}>
            {allSelected ? "取消全选" : "全选"}
          </Button>
          {!showArchived ? (
            <>
              <Button
                type="button"
                disabled={busy || !selected.size}
                onClick={() => void setVisible(productIdsFromSelection(), true)}
              >
                批量开启可见
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !selected.size}
                onClick={() => void setVisible(productIdsFromSelection(), false)}
              >
                批量关闭可见
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={busy || !selected.size}
                onClick={() => {
                  setErr("");
                  setMsg("");
                  setConfirmMode("delete");
                }}
              >
                批量删除
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={busy || !selected.size}
              onClick={() => {
                setErr("");
                setMsg("");
                setConfirmMode("restore");
              }}
            >
              批量恢复
            </Button>
          )}
          <span className="text-xs text-muted">
            已选 {selected.size} 个 SKU
            {!showArchived
              ? " · 有出入库流水的将归档隐藏，无流水直接删除"
              : " · 恢复后重新出现在库存总表"}
          </span>
        </div>
      ) : null}
      {err ? <Alert>{err}</Alert> : null}
      {msg ? <Alert tone="ok">{msg}</Alert> : null}

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              {canMaster ? <th className="px-3 py-3">选</th> : null}
              <th className="px-3 py-3">图</th>
              <th className="px-3 py-3">品牌</th>
              <th className="px-3 py-3">款号</th>
              <th className="px-3 py-3">品名</th>
              <th className="px-3 py-3">类别</th>
              <th className="px-3 py-3">颜色</th>
              <th className="px-3 py-3">尺码</th>
              <th className="px-3 py-3 text-right">库存</th>
              <th className="px-3 py-3 text-right">零售价</th>
              <th className="px-3 py-3">对门店可见</th>
              {showArchived ? <th className="px-3 py-3">状态</th> : null}
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const firstOfProduct =
                rows.find((x) => x.product_id === r.product_id)?.sku_id === r.sku_id;
              return (
                <tr
                  key={r.sku_id}
                  className={`border-b border-line last:border-0 ${
                    r.deleted_at ? "bg-amber-50/40 text-muted" : ""
                  }`}
                >
                  {canMaster ? (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.sku_id)}
                        onChange={() => toggleSku(r.sku_id)}
                        aria-label={`选择 ${r.style_no} ${r.color}/${r.size}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <div className="h-12 w-9 overflow-hidden bg-background">
                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.brand}</td>
                  <td className="px-3 py-2 font-medium">{r.style_no}</td>
                  <td className="px-3 py-2">{r.product_name}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2">{r.color}</td>
                  <td className="px-3 py-2">{r.size}</td>
                  <td className="px-3 py-2 text-right">
                    <InventoryQtyEditor
                      skuId={r.sku_id}
                      quantity={r.quantity}
                      canEdit={canStock && !r.deleted_at}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    ¥{Number(r.retail_price).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    {firstOfProduct ? (
                      canMaster && !showArchived ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void setVisible([r.product_id], !r.store_visible)
                          }
                          className={`rounded px-2 py-1 text-xs ${
                            r.store_visible
                              ? "bg-ink text-white"
                              : "border border-line text-muted"
                          }`}
                          title="款级开关，同步商品档案与所有外链"
                        >
                          {r.store_visible ? "开" : "关"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted">
                          {r.store_visible ? "开" : "关"}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted">↑同款</span>
                    )}
                  </td>
                  {showArchived ? (
                    <td className="px-3 py-2 text-xs">已归档</td>
                  ) : null}
                  <td className="px-3 py-2 text-right">
                    <Link href={`/products/${r.product_id}`} className="text-xs underline">
                      档案
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmMode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sku-batch-confirm-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden border border-line bg-surface shadow-lg">
            <div className="border-b border-line px-4 py-3">
              <h3
                id="sku-batch-confirm-title"
                className="font-[family-name:var(--font-display)] text-lg"
              >
                {confirmMode === "delete" ? "确认批量删除 / 归档" : "确认批量恢复"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {confirmMode === "delete"
                  ? "有出入库流水的 SKU 将软归档隐藏；无流水的将物理删除。出入库流水不会被破坏。"
                  : "将清空 deleted_at，SKU 重新出现在库存总表。"}
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto px-4 py-3">
              <ul className="space-y-1 text-sm">
                {selectedRows.map((r) => (
                  <li key={r.sku_id} className="flex justify-between gap-2 border-b border-line/60 py-1 last:border-0">
                    <span>
                      {r.style_no} · {r.color}/{r.size}
                    </span>
                    <span className="tabular-nums text-muted">库存 {r.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirmMode(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant={confirmMode === "delete" ? "danger" : "primary"}
                disabled={busy}
                onClick={() =>
                  void (confirmMode === "delete" ? runDeleteOrArchive() : runRestore())
                }
              >
                {busy ? "处理中…" : confirmMode === "delete" ? "确认删除/归档" : "确认恢复"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
