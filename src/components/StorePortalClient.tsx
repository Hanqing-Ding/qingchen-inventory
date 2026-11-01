"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PortalCatalogItem } from "@/types/database";
import { DEFECT_REASON_OPTIONS } from "@/types/database";
import { mockAction } from "@/lib/mock/client";
import { Alert, Button, Input } from "@/components/ui";

type Props = {
  token: string;
  shopName: string;
  shopCode: string;
  items: PortalCatalogItem[];
};

type Mode = "browse" | "request" | "repair";

/**
 * 店铺外部门户：只读目录 + 补货申请 / 返修申请（彼此独立）
 */
export function StorePortalClient({ token, shopName, shopCode, items }: Props) {
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reasonsMap, setReasonsMap] = useState<Record<string, string[]>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>("browse");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (i) =>
        i.style_no.toLowerCase().includes(s) ||
        i.product_name.toLowerCase().includes(s) ||
        i.color.toLowerCase().includes(s),
    );
  }, [items, q]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  function resetSelection() {
    setSelected({});
    setQtyMap({});
    setReasonsMap({});
    setNoteMap({});
  }

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    setQtyMap((prev) => ({ ...prev, [id]: prev[id] || "1" }));
  }

  function toggleReason(skuId: string, reason: string) {
    setReasonsMap((prev) => {
      const cur = prev[skuId] ?? [];
      const has = cur.includes(reason);
      return {
        ...prev,
        [skuId]: has ? cur.filter((r) => r !== reason) : [...cur, reason],
      };
    });
  }

  async function submitReplenish() {
    setError("");
    setSuccess("");
    const lines = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([sku_id]) => ({
        sku_id,
        quantity: Number(qtyMap[sku_id] || "0"),
      }));

    if (!lines.length) {
      setError("请先勾选需要补货的货品");
      return;
    }
    for (const l of lines) {
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
        setError("请为已选货品填写正整数数量");
        return;
      }
    }

    setLoading(true);
    try {
      const req = await mockAction<{ request_no: string }>("portalSubmitReplenish", {
        token,
        lines,
        remark: null,
      });
      setSuccess(`已提交补货需求 ${req.request_no}`);
      resetSelection();
      setMode("browse");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  async function submitRepair() {
    setError("");
    setSuccess("");
    const lines = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([sku_id]) => ({
        sku_id,
        quantity: Number(qtyMap[sku_id] || "0"),
        defect_reasons: reasonsMap[sku_id] ?? [],
        defect_note: noteMap[sku_id]?.trim() || null,
      }));

    if (!lines.length) {
      setError("请先勾选需要返修的货品");
      return;
    }
    for (const l of lines) {
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
        setError("请为已选货品填写正整数退回数量");
        return;
      }
      if (!l.defect_reasons.length && !l.defect_note) {
        setError("请为每件勾选瑕疵原因或填写备注");
        return;
      }
    }

    setLoading(true);
    try {
      const req = await mockAction<{ repair_no: string }>("portalSubmitRepair", {
        token,
        lines,
        remark: null,
      });
      setSuccess(`已提交返修申请 ${req.repair_no}`);
      resetSelection();
      setMode("browse");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#f7f7f5] pb-36">
      <header className="sticky top-0 z-10 border-b border-[#e4e4e0] bg-white/95 px-4 py-4 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#6b6b6b]">
          青陈时尚
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#111]">
          {shopName}
        </h1>
        <p className="text-xs text-[#6b6b6b]">{shopCode}</p>
        <div className="mt-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索款号 / 品名 / 颜色"
            className="bg-white"
          />
        </div>
      </header>

      <main className="space-y-3 px-4 py-4">
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert tone="ok">{success}</Alert> : null}

        {filtered.map((item) => {
          const on = Boolean(selected[item.sku_id]);
          return (
            <article
              key={item.sku_id}
              className={`flex gap-3 border bg-white p-3 ${
                on ? "border-[#111]" : "border-[#e4e4e0]"
              }`}
            >
              <div className="h-24 w-[4.5rem] shrink-0 overflow-hidden bg-[#f0f0ee]">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.product_name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[#111]">{item.style_no}</div>
                <div className="truncate text-xs text-[#6b6b6b]">{item.product_name}</div>
                <div className="mt-1 text-sm text-[#111]">
                  {item.color} / {item.size}
                </div>
                <div className="mt-1 text-xs text-[#6b6b6b]">
                  当前可配库存{" "}
                  <span className="tabular-nums text-[#111]">{item.quantity}</span>
                </div>
                {mode === "browse" ? (
                  <Link
                    href={`/store-portal/${token}/products/${item.product_id}`}
                    className="mt-2 inline-block text-xs underline text-[#111]"
                  >
                    查看图片 / 下载
                  </Link>
                ) : null}

                {mode === "request" || mode === "repair" ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(item.sku_id)}
                        />
                        {mode === "request" ? "补货" : "返修"}
                      </label>
                      {on ? (
                        <input
                          type="number"
                          min={1}
                          className="w-20 border border-[#e4e4e0] px-2 py-1 text-sm"
                          value={qtyMap[item.sku_id] ?? "1"}
                          onChange={(e) =>
                            setQtyMap((prev) => ({
                              ...prev,
                              [item.sku_id]: e.target.value,
                            }))
                          }
                        />
                      ) : null}
                    </div>
                    {mode === "repair" && on ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {DEFECT_REASON_OPTIONS.map((r) => {
                            const checked = (reasonsMap[item.sku_id] ?? []).includes(r);
                            return (
                              <label
                                key={r}
                                className="flex items-center gap-1 text-[11px] text-[#333]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleReason(item.sku_id, r)}
                                />
                                {r}
                              </label>
                            );
                          })}
                        </div>
                        <input
                          className="w-full border border-[#e4e4e0] px-2 py-1 text-xs"
                          placeholder="瑕疵备注（可选）"
                          value={noteMap[item.sku_id] ?? ""}
                          onChange={(e) =>
                            setNoteMap((prev) => ({
                              ...prev,
                              [item.sku_id]: e.target.value,
                            }))
                          }
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}

        {!filtered.length ? (
          <p className="py-16 text-center text-sm text-[#6b6b6b]">没有匹配货品</p>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-[#e4e4e0] bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {mode === "browse" ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  resetSelection();
                  setMode("repair");
                }}
              >
                提交返修申请
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  resetSelection();
                  setMode("request");
                }}
              >
                提交补货需求
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setMode("browse");
                  resetSelection();
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                className="flex-[2]"
                disabled={loading || selectedCount === 0}
                onClick={mode === "request" ? submitReplenish : submitRepair}
              >
                {loading
                  ? "提交中…"
                  : mode === "request"
                    ? `确认补货（${selectedCount}）`
                    : `确认返修（${selectedCount}）`}
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
