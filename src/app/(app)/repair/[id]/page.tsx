import Link from "next/link";
import { notFound } from "next/navigation";
import { isMockPreview } from "@/lib/mock/mode";
import { mockGetRepair } from "@/lib/mock/store";
import {
  REPAIR_STATUS_LABEL,
  type RepairStatus,
} from "@/types/database";
import { PageHeader } from "@/components/ui";
import { RepairActions } from "@/components/RepairActions";
import { StyleThumb } from "@/components/StyleThumb";
import { format } from "date-fns";

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isMockPreview()) notFound();

  const order = mockGetRepair(id);
  if (!order) notFound();

  const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
  const status = order.status as RepairStatus;

  return (
    <div>
      <PageHeader
        title={`返修单 ${order.repair_no}`}
        description={REPAIR_STATUS_LABEL[status]}
        actions={
          <Link href="/replenish?tab=repair" className="text-sm underline">
            返回列表
          </Link>
        }
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
          <span className="text-muted">来源：</span>
          {order.source === "portal" ? "店铺门户" : "后台录入"}
        </div>
        <div>
          <span className="text-muted">创建：</span>
          {format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}
        </div>
        <div>
          <span className="text-muted">备注：</span>
          {order.remark || "—"}
        </div>
        {order.received_at ? (
          <div>
            <span className="text-muted">签收：</span>
            {format(new Date(order.received_at), "yyyy-MM-dd HH:mm")}
          </div>
        ) : null}
        {order.repaired_at ? (
          <div>
            <span className="text-muted">修复完成：</span>
            {format(new Date(order.repaired_at), "yyyy-MM-dd HH:mm")}
          </div>
        ) : null}
        {order.shipped_at ? (
          <div>
            <span className="text-muted">发出：</span>
            {format(new Date(order.shipped_at), "yyyy-MM-dd HH:mm")}
          </div>
        ) : null}
        {order.scrapped_at ? (
          <div>
            <span className="text-muted">报废：</span>
            {format(new Date(order.scrapped_at), "yyyy-MM-dd HH:mm")}
          </div>
        ) : null}
      </div>

      <div className="mb-8">
        <RepairActions repairId={order.id} status={status} />
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-3">图</th>
              <th className="px-3 py-3">款号</th>
              <th className="px-3 py-3">颜色</th>
              <th className="px-3 py-3">尺码</th>
              <th className="px-3 py-3 text-right">数量</th>
              <th className="px-3 py-3">瑕疵原因</th>
              <th className="px-3 py-3">备注</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <StyleThumb src={item.image_url} alt={item.style_no} />
                </td>
                <td className="px-3 py-2 font-medium">{item.style_no}</td>
                <td className="px-3 py-2">{item.color}</td>
                <td className="px-3 py-2">{item.size}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="px-3 py-2">
                  {item.defect_reasons.length ? item.defect_reasons.join("、") : "—"}
                </td>
                <td className="px-3 py-2 text-muted">{item.defect_note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
