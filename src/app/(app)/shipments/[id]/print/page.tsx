import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockGetShipment, mockResolveShipmentShipTo } from "@/lib/mock/store";
import { StyleThumb } from "@/components/StyleThumb";
import { format } from "date-fns";
import { PrintActions } from "./PrintActions";

export default async function ShipmentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let orderNo = "";
  let status = "";
  let remark: string | null = null;
  let createdAt = "";
  let submittedAt: string | null = null;
  type ShopInfo = {
    name?: string;
    code?: string;
    contact_name?: string;
    phone?: string;
    address?: string;
  };
  let shop: ShopInfo | null = null;
  let shipLabel = "发往店铺";
  let operatorName = "—";
  let lines: {
    brand: string;
    style_no: string;
    name: string;
    color: string;
    size: string;
    quantity: number;
    image_url?: string | null;
  }[] = [];

  if (isMockPreview()) {
    const s = mockGetShipment(id);
    if (!s) notFound();
    orderNo = s.order_no;
    status = s.status;
    createdAt = s.created_at;
    submittedAt = s.submitted_at;
    const resolved = mockResolveShipmentShipTo(s.shop_id);
    shop = {
      name: resolved.shipTo.name,
      code: resolved.shipTo.code,
      contact_name: resolved.shipTo.contact_name ?? undefined,
      phone: resolved.shipTo.phone ?? undefined,
      address: resolved.shipTo.address ?? undefined,
    };
    shipLabel = resolved.sourceShop ? "收货总部" : "发往店铺";
    const parts = [s.remark, resolved.sourceNote].filter(Boolean);
    remark = parts.length ? parts.join("；") : null;
    operatorName = "开发管理员";
    lines = s.items.map((i) => ({
      brand: i.brand,
      style_no: i.style_no,
      name: i.product_name,
      color: i.color,
      size: i.size,
      quantity: i.quantity,
      image_url: i.image_url,
    }));
  } else {
    const supabase = await createClient();
    const { fetchShipmentPrint } = await import("@/lib/db/queries");
    const printed = await fetchShipmentPrint(supabase, id);
    if (!printed) notFound();
    orderNo = printed.orderNo;
    status = printed.status;
    remark = printed.remark;
    createdAt = printed.createdAt;
    submittedAt = printed.submittedAt;
    shop = printed.shop;
    shipLabel = printed.shipLabel ?? "发往店铺";
    operatorName = printed.operatorName;
    lines = printed.lines;
  }

  return (
    <div className="print-sheet mx-auto max-w-3xl border border-line bg-surface p-6 md:p-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/shipments" className="text-sm text-muted underline">
          返回发货列表
        </Link>
        <PrintActions />
      </div>

      <header className="mb-8 border-b border-ink pb-4 text-center">
        <div className="font-[family-name:var(--font-display)] text-3xl tracking-[0.16em]">
          青陈时尚
        </div>
        <div className="mt-2 text-sm uppercase tracking-[0.28em] text-muted">
          出库单 · 仓库打包
        </div>
      </header>

      <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted">发货单号：</span>
          <strong>{orderNo}</strong>
        </div>
        <div>
          <span className="text-muted">{shipLabel}：</span>
          {shop?.name ?? "—"}
          {shop?.code ? `（${shop.code}）` : ""}
        </div>
        <div>
          <span className="text-muted">对接人：</span>
          {shop?.contact_name || "—"}
          {shop?.phone ? ` / ${shop.phone}` : ""}
        </div>
        <div className="sm:col-span-2">
          <span className="text-muted">地址：</span>
          {shop?.address || "—"}
        </div>
        <div>
          <span className="text-muted">状态：</span>
          {status === "submitted" ? "已提交" : "草稿"}
        </div>
        <div>
          <span className="text-muted">时间：</span>
          {format(new Date(submittedAt ?? createdAt), "yyyy-MM-dd HH:mm")}
        </div>
        <div>
          <span className="text-muted">操作人：</span>
          {operatorName}
        </div>
        <div>
          <span className="text-muted">备注：</span>
          {remark || "—"}
        </div>
      </div>

      <table className="mb-10 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-ink text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">图</th>
            <th className="py-2 pr-2">品牌</th>
            <th className="py-2 pr-2">款号</th>
            <th className="py-2 pr-2">品名</th>
            <th className="py-2 pr-2">颜色</th>
            <th className="py-2 pr-2">尺码</th>
            <th className="py-2 text-right">数量</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className="border-b border-line">
              <td className="py-2 pr-2">{idx + 1}</td>
              <td className="py-2 pr-2">
                <StyleThumb src={line.image_url} alt={line.style_no} className="h-14 w-10" />
              </td>
              <td className="py-2 pr-2">{line.brand}</td>
              <td className="py-2 pr-2 font-medium">{line.style_no}</td>
              <td className="py-2 pr-2">{line.name}</td>
              <td className="py-2 pr-2">{line.color}</td>
              <td className="py-2 pr-2">{line.size}</td>
              <td className="py-2 text-right tabular-nums">{line.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-8 text-sm">
        <div className="border-t border-line pt-3">拣货人签字：</div>
        <div className="border-t border-line pt-3">复核人签字：</div>
      </div>

      <div className="no-print mt-8">
        <Link href="/replenish" className="text-sm text-muted underline">
          返回补货需求
        </Link>
      </div>
    </div>
  );
}
