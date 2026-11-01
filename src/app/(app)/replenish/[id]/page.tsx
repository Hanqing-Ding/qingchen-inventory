import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockGetReplenish } from "@/lib/mock/store";
import {
  REPLENISH_STATUS_LABEL,
  type ReplenishRequest,
  type ReplenishRequestItem,
  type ReplenishStatus,
} from "@/types/database";
import { PageHeader } from "@/components/ui";
import { ReplenishFulfillButton } from "@/components/ReplenishFulfillButton";
import { StyleThumb } from "@/components/StyleThumb";
import { format } from "date-fns";
import { flattenInventory } from "@/lib/mock/seed";
import { getMockDb } from "@/lib/mock/store";

export default async function ReplenishDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request: (ReplenishRequest & { items?: ReplenishRequestItem[] }) | null = null;
  let lines: ReplenishRequestItem[] = [];

  if (isMockPreview()) {
    const r = mockGetReplenish(id);
    if (!r) notFound();
    request = r;
    const inv = flattenInventory(getMockDb().products);
    // 自动带出款式图（明细无图时按 SKU 回填）
    lines = r.items.map((item) => ({
      ...item,
      image_url:
        item.image_url ||
        inv.find((x) => x.sku_id === item.product_sku_id)?.image_url ||
        null,
    }));
  } else {
    // 四表模式无补货需求表
    void createClient;
    notFound();
  }

  const shop = Array.isArray(request.shops) ? request.shops[0] : request.shops;

  return (
    <div>
      <PageHeader
        title={`补货需求 ${request.request_no}`}
        description={`${request.request_date} · ${REPLENISH_STATUS_LABEL[request.status as ReplenishStatus]}`}
      />

      <div className="mb-6 grid gap-2 border border-line bg-surface p-4 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted">店铺：</span>
          {(shop as { name?: string; code?: string } | null)?.name ?? "—"}
          {(shop as { code?: string } | null)?.code
            ? `（${(shop as { code: string }).code}）`
            : ""}
        </div>
        <div>
          <span className="text-muted">对接人：</span>
          {(shop as { contact_name?: string } | null)?.contact_name || "—"}
          {(shop as { phone?: string } | null)?.phone
            ? ` / ${(shop as { phone: string }).phone}`
            : ""}
        </div>
        <div className="sm:col-span-2">
          <span className="text-muted">地址：</span>
          {(shop as { address?: string } | null)?.address || "—"}
        </div>
        <div>
          <span className="text-muted">创建：</span>
          {format(new Date(request.created_at), "yyyy-MM-dd HH:mm")}
        </div>
        <div>
          <span className="text-muted">备注：</span>
          {request.remark || "—"}
        </div>
        {request.shipment_order_id ? (
          <div className="sm:col-span-2">
            <span className="text-muted">出库单：</span>
            <Link
              href={`/shipments/${request.shipment_order_id}/print`}
              className="underline"
            >
              查看 / 打印
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mb-8 overflow-x-auto border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-3">图</th>
              <th className="px-3 py-3">款号</th>
              <th className="px-3 py-3">颜色</th>
              <th className="px-3 py-3">尺码</th>
              <th className="px-3 py-3 text-right">需求数量</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <StyleThumb src={l.image_url} alt={l.style_no} />
                </td>
                <td className="px-3 py-2 font-medium">{l.style_no}</td>
                <td className="px-3 py-2">{l.color}</td>
                <td className="px-3 py-2">{l.size}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
              </tr>
            ))}
            {!lines.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  无明细
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {request.status === "open" ? (
        <ReplenishFulfillButton requestId={request.id} />
      ) : (
        <p className="text-sm text-muted">
          当前状态：{REPLENISH_STATUS_LABEL[request.status as ReplenishStatus]}
        </p>
      )}
    </div>
  );
}
