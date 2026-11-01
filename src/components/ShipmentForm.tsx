"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import type { Shop } from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  composeShipmentRemark,
  resolveShipmentShipTo,
} from "@/lib/db/shops";

type Line = {
  product_sku_id: string;
  style_no: string;
  color: string;
  size: string;
  quantity: number;
  available: number;
};

/** 补货发货单：下拉选店铺，搜索款号带出颜色尺码，提交扣库存 */
export function ShipmentForm({ shops }: { shops: Shop[] }) {
  const router = useRouter();
  const activeShops = useMemo(
    () => shops.filter((s) => !s.deleted_at && s.is_active !== false),
    [shops],
  );
  const [shopId, setShopId] = useState(activeShops[0]?.id ?? "");
  const selectedShop = useMemo(
    () => activeShops.find((s) => s.id === shopId) ?? null,
    [activeShops, shopId],
  );
  const resolved = useMemo(
    () => (selectedShop ? resolveShipmentShipTo(selectedShop, activeShops) : null),
    [selectedShop, activeShops],
  );
  const [styleNo, setStyleNo] = useState("");
  const [skuOptions, setSkuOptions] = useState<
    { id: string; color: string; size: string; quantity: number; style_no: string }[]
  >([]);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [qty, setQty] = useState("1");
  const [lines, setLines] = useState<Line[]>([]);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchSkus() {
    setError("");
    if (!styleNo.trim()) {
      setError("请输入款号");
      return;
    }

    try {
      if (isMockPreview()) {
        const opts = await mockAction<
          { id: string; color: string; size: string; quantity: number; style_no: string }[]
        >("searchSkus", { style_no: styleNo.trim() });
        setSkuOptions(opts);
        setSelectedSkuId(opts[0]?.id ?? "");
        if (!opts.length) setError("未找到该款号下的颜色尺码");
        return;
      }

      const supabase = createClient();
      const { data: styles, error: pErr } = await supabase
        .from("clothing_styles")
        .select("id, style_no, skus(id, color, size, current_stock, deleted_at)")
        .ilike("style_no", `%${styleNo.trim()}%`)
        .limit(20);

      if (pErr) {
        setError(pErr.message);
        return;
      }

      const opts =
        styles?.flatMap((p) =>
          (p.skus ?? [])
            .filter(
              (s: { deleted_at?: string | null }) => !s.deleted_at,
            )
            .map(
              (s: {
                id: string;
                color: string;
                size: string;
                current_stock: number;
              }) => ({
                id: s.id,
                color: s.color,
                size: s.size,
                quantity: s.current_stock ?? 0,
                style_no: p.style_no as string,
              }),
            ),
        ) ?? [];

      setSkuOptions(opts);
      setSelectedSkuId(opts[0]?.id ?? "");
      if (!opts.length) setError("未找到该款号下的颜色尺码");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "搜索失败");
    }
  }

  function addLine() {
    setError("");
    const sku = skuOptions.find((s) => s.id === selectedSkuId);
    const quantity = Number(qty);
    if (!sku) {
      setError("请先搜索并选择颜色尺码");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("发货数量须为正整数");
      return;
    }

    const existingQty = lines.find((l) => l.product_sku_id === sku.id)?.quantity ?? 0;
    if (existingQty + quantity > sku.quantity) {
      setError(
        `库存不足：${sku.style_no} ${sku.color}/${sku.size} 可用 ${sku.quantity}，已录 ${existingQty}，再加 ${quantity} 将超库存`,
      );
      return;
    }

    setLines((prev) => {
      const exist = prev.find((l) => l.product_sku_id === sku.id);
      if (exist) {
        return prev.map((l) =>
          l.product_sku_id === sku.id
            ? { ...l, quantity: l.quantity + quantity, available: sku.quantity }
            : l,
        );
      }
      return [
        ...prev,
        {
          product_sku_id: sku.id,
          style_no: sku.style_no,
          color: sku.color,
          size: sku.size,
          quantity,
          available: sku.quantity,
        },
      ];
    });
  }

  function removeLine(skuId: string) {
    setLines((prev) => prev.filter((l) => l.product_sku_id !== skuId));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!shopId || !selectedShop || !resolved) {
      setError("请选择店铺");
      return;
    }
    if (!lines.length) {
      setError("请至少添加一行明细");
      return;
    }

    for (const l of lines) {
      if (l.quantity > l.available) {
        setError(`库存不足，禁止负库存：${l.style_no} ${l.color}/${l.size}`);
        return;
      }
    }

    const finalRemark = composeShipmentRemark(remark, resolved.sourceNote);

    setLoading(true);
    try {
      if (isMockPreview()) {
        const ship = await mockAction<{ id: string }>("manualShipment", {
          shop_id: shopId,
          remark: finalRemark,
          lines: lines.map((l) => ({
            product_sku_id: l.product_sku_id,
            quantity: l.quantity,
          })),
        });
        router.push(`/shipments/${ship.id}/print`);
      } else {
        const supabase = createClient();
        const { submitStockOut } = await import("@/lib/db/stock");
        // customer 存选中店铺名称（兼容旧数据）；shop_id 关联 shops
        const ship = await submitStockOut(supabase, {
          customer: resolved.customerName,
          shop_id: selectedShop.code,
          remark: finalRemark,
          lines: lines.map((l) => ({
            sku_id: l.product_sku_id,
            quantity: l.quantity,
          })),
        });
        router.push(`/shipments/${ship.order_no}/print`);
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "提交失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2 border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Field label="发往合作店铺 *">
            <Select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              required
              className="min-w-[16rem]"
            >
              {!activeShops.length ? (
                <option value="">暂无店铺，请先维护</option>
              ) : null}
              {activeShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{s.code}）
                  {s.shop_type === "下属门店" || s.shop_kind === "branch"
                    ? " · 下属门店"
                    : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Link href="/shops" className="mb-1 text-xs text-muted underline">
            管理合作店铺
          </Link>
        </div>
        {resolved ? (
          <dl className="grid gap-1 text-xs text-muted sm:grid-cols-2">
            <div>对接人：{resolved.shipTo.contact_name || "—"}</div>
            <div>电话：{resolved.shipTo.phone || "—"}</div>
            <div className="sm:col-span-2">
              收货地址：{resolved.shipTo.address || "—"}
              {resolved.sourceShop ? (
                <span className="ml-1 text-ink">
                  （取自父店 {resolved.shipTo.name}）
                </span>
              ) : null}
            </div>
            {resolved.sourceNote ? (
              <div className="sm:col-span-2 text-ink">{resolved.sourceNote}</div>
            ) : null}
            {selectedShop?.remark ? (
              <div className="sm:col-span-2">店铺备注：{selectedShop.remark}</div>
            ) : null}
          </dl>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="款号搜索（快速带出颜色尺码）">
          <Input
            value={styleNo}
            onChange={(e) => setStyleNo(e.target.value)}
            placeholder="输入款号"
          />
        </Field>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={searchSkus}>
            搜索
          </Button>
        </div>
      </div>

      {skuOptions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <Field label="颜色 / 尺码">
            <select
              className="w-full border border-line bg-surface px-3 py-2 text-sm"
              value={selectedSkuId}
              onChange={(e) => setSelectedSkuId(e.target.value)}
            >
              {skuOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.style_no} · {s.color} / {s.size}（库存 {s.quantity}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="发货数量">
            <Input
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={addLine}>
              加入明细
            </Button>
          </div>
        </div>
      ) : null}

      <Field label="备注">
        <Textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} />
        {resolved?.sourceNote ? (
          <p className="mt-1 text-xs text-muted">
            提交时自动附带 {resolved.sourceNote}
          </p>
        ) : null}
      </Field>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2">款号</th>
              <th className="px-3 py-2">颜色</th>
              <th className="px-3 py-2">尺码</th>
              <th className="px-3 py-2 text-right">可用</th>
              <th className="px-3 py-2 text-right">发货数</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.product_sku_id} className="border-b border-line">
                <td className="px-3 py-2">{l.style_no}</td>
                <td className="px-3 py-2">{l.color}</td>
                <td className="px-3 py-2">{l.size}</td>
                <td className="px-3 py-2 text-right">{l.available}</td>
                <td className="px-3 py-2 text-right font-medium">{l.quantity}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-muted underline"
                    onClick={() => removeLine(l.product_sku_id)}
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

      {error ? <Alert>{error}</Alert> : null}

      <Button type="submit" disabled={loading || !lines.length || !shopId}>
        {loading ? "提交中…" : "提交发货（扣减库存）"}
      </Button>
      <p className="text-xs text-muted">提交成功后将打开可打印发货单，供仓库打包。</p>
    </form>
  );
}
