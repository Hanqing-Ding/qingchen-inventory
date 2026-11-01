"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import type { Shop } from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { StyleThumb } from "@/components/StyleThumb";

type DraftLine = {
  style_no: string;
  color: string;
  size: string;
  quantity: number;
  image_url?: string | null;
};

/** 跟单录入每日补货需求（选店 + 多行明细） */
export function ReplenishCreateForm({ shops }: { shops: Shop[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const [requestDate, setRequestDate] = useState(today);
  const [remark, setRemark] = useState("");
  const [styleNo, setStyleNo] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState("1");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function resolveImage(style: string): Promise<string | null> {
    if (isMockPreview()) {
      try {
        const r = await mockAction<{ image_url: string | null }>("lookupStyleImage", {
          style_no: style,
        });
        return r.image_url;
      } catch {
        return null;
      }
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("clothing_styles")
      .select("cover_img")
      .ilike("style_no", style)
      .maybeSingle();
    return data?.cover_img ?? null;
  }

  async function addLine() {
    setError("");
    const quantity = Number(qty);
    if (!styleNo.trim() || !color.trim()) {
      setError("请填写款号和颜色");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("数量须为正整数");
      return;
    }
    const usedSize = size.trim() || "均码";
    const image_url = await resolveImage(styleNo.trim());
    setLines((prev) => {
      const idx = prev.findIndex(
        (l) =>
          l.style_no.toLowerCase() === styleNo.trim().toLowerCase() &&
          l.color === color.trim() &&
          l.size === usedSize,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      return [
        ...prev,
        {
          style_no: styleNo.trim(),
          color: color.trim(),
          size: usedSize,
          quantity,
          image_url,
        },
      ];
    });
    setColor("");
    setQty("1");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!shopId) {
      setError("请选择合作店铺");
      return;
    }
    if (!lines.length) {
      setError("请至少添加一行需求明细");
      return;
    }

    setLoading(true);
    try {
      if (isMockPreview()) {
        const req = await mockAction<{ id: string }>("createReplenish", {
          shop_id: shopId,
          request_date: requestDate,
          remark: remark.trim() || null,
          lines,
        });
        router.push(`/replenish/${req.id}`);
      } else {
        // 四表模式无补货需求表：直接按明细出库（等同新建出库单）
        const supabase = createClient();
        const { submitStockOut } = await import("@/lib/db/stock");
        const { shopDisplayName } = await import("@/lib/db/queries");
        const selected = shops.find((s) => s.id === shopId) ?? null;
        const customer = shopDisplayName(selected, shopId);

        const resolved: { sku_id: string; quantity: number }[] = [];
        for (const line of lines) {
          const { data: style } = await supabase
            .from("clothing_styles")
            .select("id, skus(id, color, size)")
            .ilike("style_no", line.style_no)
            .maybeSingle();
          if (!style) throw new Error(`未找到款号「${line.style_no}」`);
          const skus = (style.skus ?? []) as { id: string; color: string; size: string }[];
          const sku = skus.find((s) => s.color === line.color && s.size === line.size);
          if (!sku) {
            throw new Error(`未找到 SKU：${line.style_no} ${line.color}/${line.size}`);
          }
          resolved.push({ sku_id: sku.id, quantity: line.quantity });
        }

        const ship = await submitStockOut(supabase, {
          customer,
          remark: [remark.trim(), `补货需求 ${requestDate}`].filter(Boolean).join("；") || null,
          lines: resolved,
        });
        router.push(`/shipments/${ship.order_no}/print`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="发往店铺 *">
          <Select value={shopId} onChange={(e) => setShopId(e.target.value)} required>
            {!shops.length ? <option value="">请先维护合作店铺</option> : null}
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.code}）
              </option>
            ))}
          </Select>
        </Field>
        <Field label="需求日期 *">
          <Input
            type="date"
            value={requestDate}
            onChange={(e) => setRequestDate(e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="border border-line bg-surface p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.14em] text-muted">添加明细</div>
        <div className="grid gap-3 sm:grid-cols-5">
          <Input
            placeholder="款号 *"
            value={styleNo}
            onChange={(e) => setStyleNo(e.target.value)}
          />
          <Input
            placeholder="颜色 *"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <Input
            placeholder="尺码（默认均码）"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            placeholder="数量"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={addLine}>
            加入
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2">图</th>
              <th className="px-3 py-2">款号</th>
              <th className="px-3 py-2">颜色</th>
              <th className="px-3 py-2">尺码</th>
              <th className="px-3 py-2 text-right">数量</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.style_no}-${l.color}-${l.size}-${i}`} className="border-b border-line">
                <td className="px-3 py-2">
                  <StyleThumb src={l.image_url} alt={l.style_no} />
                </td>
                <td className="px-3 py-2 font-medium">{l.style_no}</td>
                <td className="px-3 py-2">{l.color}</td>
                <td className="px-3 py-2">{l.size}</td>
                <td className="px-3 py-2 text-right">{l.quantity}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-muted underline"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    移除
                  </button>
                </td>
              </tr>
            ))}
            {!lines.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  尚未添加明细
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Field label="整单备注（可选）">
        <Textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} />
      </Field>

      {error ? <Alert>{error}</Alert> : null}

      <Button type="submit" disabled={loading || !lines.length}>
        {loading ? "提交中…" : "提交补货需求（供仓库拣货）"}
      </Button>
    </form>
  );
}
