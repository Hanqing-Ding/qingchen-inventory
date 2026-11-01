"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import { Alert, Button, Field, Input } from "@/components/ui";
import { InboundPrintSlip, type InboundSlipLine } from "@/components/InboundPrintSlip";

type RecentRow = InboundSlipLine;

/** 快捷入库（仅手动）：Mock 预览走内存，否则走 Supabase quick_inbound */
export function InboundForm() {
  const router = useRouter();
  const [styleNo, setStyleNo] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [printLines, setPrintLines] = useState<InboundSlipLine[] | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const quantity = Number(qty);
    if (!styleNo.trim()) {
      setError("请填写款号");
      return;
    }
    if (!color.trim()) {
      setError("请填写颜色");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("数量须为正整数");
      return;
    }

    setLoading(true);
    try {
      let order: RecentRow;
      if (isMockPreview()) {
        order = await mockAction<RecentRow>("quickInbound", {
          style_no: styleNo.trim(),
          color: color.trim(),
          size: size.trim() || null,
          quantity,
        });
      } else {
        const supabase = createClient();
        const { quickInbound } = await import("@/lib/db/stock");
        order = await quickInbound(supabase, {
          style_no: styleNo.trim(),
          color: color.trim(),
          size: size.trim() || null,
          quantity,
        });
      }

      setInfo(
        `入库成功 ${order.order_no}：${order.style_no} / ${order.color} / ${order.size} × ${order.quantity}`,
      );
      setRecent((prev) => [order, ...prev].slice(0, 8));
      setPrintLines([order]);
      setColor("");
      setQty("1");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "入库失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="款号 *">
            <Input
              value={styleNo}
              onChange={(e) => setStyleNo(e.target.value)}
              placeholder="如：QC-2401"
              required
              autoComplete="off"
            />
          </Field>
          <Field label="颜色 *">
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="如：黑色"
              required
              autoComplete="off"
            />
          </Field>
          <Field label="尺码（可空，默认均码）">
            <Input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="均码 / S / M / L…"
              autoComplete="off"
            />
          </Field>
          <Field label="数量 *">
            <Input
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </Field>
        </div>

        {error ? <Alert>{error}</Alert> : null}
        {info ? <Alert tone="ok">{info}</Alert> : null}

        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? "入库中…" : "一键入库"}
        </Button>
        <p className="text-xs text-muted">
          提交后自动增加库存并记流水。款号须已建档；若该颜色尺码尚无 SKU 会自动补建。
          {isMockPreview() ? "（当前为 Mock 预览）" : ""}
        </p>
      </form>

      {recent.length > 0 ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs uppercase tracking-[0.14em] text-muted">本次会话已入库</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPrintLines([...recent].reverse())}
            >
              打印 / 导出本批入库单
            </Button>
          </div>
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">单号</th>
                  <th className="px-3 py-2">款号</th>
                  <th className="px-3 py-2">颜色</th>
                  <th className="px-3 py-2">尺码</th>
                  <th className="px-3 py-2 text-right">数量</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={`${r.order_no}-${i}`} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{r.order_no}</td>
                    <td className="px-3 py-2 font-medium">{r.style_no}</td>
                    <td className="px-3 py-2">{r.color}</td>
                    <td className="px-3 py-2">{r.size}</td>
                    <td className="px-3 py-2 text-right">{r.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setPrintLines([r])}
                      >
                        打印
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {printLines?.length ? (
        <InboundPrintSlip lines={printLines} onClose={() => setPrintLines(null)} />
      ) : null}
    </div>
  );
}
