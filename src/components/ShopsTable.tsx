"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SHOP_KIND_LABEL,
  SHOP_TYPE_LABEL,
  type Shop,
} from "@/types/database";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import { Alert, Button } from "@/components/ui";

type Props = {
  shops: Shop[];
  canEdit: boolean;
  showArchived?: boolean;
};

/** 合作店铺列表：复选 + 批量归档 / 恢复 */
export function ShopsTable({ shops, canEdit, showArchived = false }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);

  const selectedShops = useMemo(
    () => shops.filter((s) => selected.has(s.id)),
    [shops, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const ids = shops.map((s) => s.id);
    setSelected((prev) =>
      prev.size === ids.length && ids.length > 0 ? new Set() : new Set(ids),
    );
  }

  async function runArchiveOrRestore() {
    if (!canEdit || !selectedShops.length) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const codes = selectedShops.map((s) => s.code);
      if (isMockPreview()) {
        if (showArchived) {
          const res = await mockAction<{ restored: number }>("batchRestoreShops", {
            shopCodes: codes,
          });
          setMsg(`已恢复 ${res.restored} 家店铺`);
        } else {
          const res = await mockAction<{ archived: number }>("batchArchiveShops", {
            shopCodes: codes,
          });
          setMsg(`已归档 ${res.archived} 家店铺（有出库单的也仅软删除）`);
        }
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const { batchArchiveShops, batchRestoreShops } = await import(
          "@/lib/db/shops"
        );
        const sb = createClient();
        if (showArchived) {
          const res = await batchRestoreShops(sb, codes);
          setMsg(`已恢复 ${res.restored} 家店铺`);
        } else {
          const res = await batchArchiveShops(sb, codes);
          setMsg(`已归档 ${res.archived} 家店铺（有出库单的也仅软删除，不物理删除）`);
        }
      }
      setSelected(new Set());
      setConfirm(false);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "操作失败");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  const allSelected = shops.length > 0 && selected.size === shops.length;

  return (
    <div className="space-y-3">
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button type="button" variant="secondary" onClick={toggleAll} disabled={busy}>
            {allSelected ? "取消全选" : "全选"}
          </Button>
          <Button
            type="button"
            variant={showArchived ? "primary" : "danger"}
            disabled={busy || !selected.size}
            onClick={() => {
              setErr("");
              setMsg("");
              setConfirm(true);
            }}
          >
            {showArchived ? "批量恢复" : "批量归档"}
          </Button>
          <span className="text-xs text-muted">
            已选 {selected.size} 家
            {showArchived
              ? " · 恢复后可再次用于出库"
              : " · 有关联出库单的店铺禁止物理删除，仅软归档"}
          </span>
        </div>
      ) : null}
      {err ? <Alert>{err}</Alert> : null}
      {msg ? <Alert tone="ok">{msg}</Alert> : null}

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              {canEdit ? <th className="px-3 py-3">选</th> : null}
              <th className="px-3 py-3">编码</th>
              <th className="px-3 py-3">名称</th>
              <th className="px-3 py-3">类型</th>
              <th className="px-3 py-3">对接人</th>
              <th className="px-3 py-3">电话</th>
              <th className="px-3 py-3">地址</th>
              <th className="px-3 py-3">状态</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => {
              const parent = s.parent_id
                ? shops.find((x) => x.id === s.parent_id) ?? null
                : null;
              const typeLabel =
                s.shop_type ??
                (s.shop_kind ? SHOP_KIND_LABEL[s.shop_kind] : "—");
              return (
                <tr
                  key={s.id}
                  className={`border-b border-line last:border-0 ${
                    s.deleted_at ? "bg-amber-50/40 text-muted" : ""
                  }`}
                >
                  {canEdit ? (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`选择 ${s.name}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2 font-medium">{s.code}</td>
                  <td className="px-3 py-2">
                    {s.name}
                    {parent ? (
                      <div className="text-[10px] text-muted">隶属 {parent.name}</div>
                    ) : s.parent_id ? (
                      <div className="text-[10px] text-muted">隶属 {s.parent_id}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {typeof typeLabel === "string" && typeLabel in SHOP_TYPE_LABEL
                      ? SHOP_TYPE_LABEL[typeLabel as keyof typeof SHOP_TYPE_LABEL]
                      : typeLabel}
                  </td>
                  <td className="px-3 py-2">{s.contact_name || "—"}</td>
                  <td className="px-3 py-2">{s.phone || "—"}</td>
                  <td className="px-3 py-2 max-w-[12rem] truncate" title={s.address ?? ""}>
                    {s.address || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {s.deleted_at ? "已归档" : s.is_active ? "启用" : "停用"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!s.deleted_at ? (
                      <Link href={`/shops/${encodeURIComponent(s.id)}`} className="underline">
                        编辑
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden border border-line bg-surface shadow-lg">
            <div className="border-b border-line px-4 py-3">
              <h3 className="font-[family-name:var(--font-display)] text-lg">
                {showArchived ? "确认批量恢复" : "确认批量归档"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {showArchived
                  ? "恢复后店铺可再次用于出库选单。"
                  : "有关联出库单据的店铺禁止物理删除，仅写入 deleted_at 软归档。"}
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto px-4 py-3">
              <ul className="space-y-1 text-sm">
                {selectedShops.map((s) => (
                  <li key={s.id} className="border-b border-line/60 py-1 last:border-0">
                    {s.name}（{s.code}）
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant={showArchived ? "primary" : "danger"}
                disabled={busy}
                onClick={() => void runArchiveOrRestore()}
              >
                {busy ? "处理中…" : showArchived ? "确认恢复" : "确认归档"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
