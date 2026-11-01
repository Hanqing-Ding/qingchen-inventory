import Link from "next/link";
import { notFound } from "next/navigation";
import { isMockPreview } from "@/lib/mock/mode";
import { mockGetRepair } from "@/lib/mock/store";
import { REPAIR_STATUS_LABEL, type RepairStatus } from "@/types/database";
import { format } from "date-fns";
import { PrintActions } from "@/app/(app)/shipments/[id]/print/PrintActions";

export default async function RepairPrintPage({
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
    <div className="print-sheet mx-auto max-w-3xl border border-line bg-surface p-6 md:p-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/repair/${id}`} className="text-sm text-muted underline">
          返回返修单
        </Link>
        <PrintActions printLabel="打印返修单" pdfLabel="导出返修单 PDF" />
      </div>

      <header className="mb-8 border-b border-ink pb-4 text-center">
        <div className="font-[family-name:var(--font-display)] text-3xl tracking-[0.16em]">
          青陈时尚
        </div>
        <div className="mt-2 text-sm uppercase tracking-[0.28em] text-muted">
          返修发货单
        </div>
      </header>

      <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted">返修单号：</span>
          <strong>{order.repair_no}</strong>
        </div>
        <div>
          <span className="text-muted">店铺名称：</span>
          {(shop as { name?: string } | null)?.name ?? "—"}
          {(shop as { code?: string } | null)?.code
            ? `（${(shop as { code: string }).code}）`
            : ""}
        </div>
        <div>
          <span className="text-muted">状态：</span>
          {REPAIR_STATUS_LABEL[status]}
        </div>
        <div>
          <span className="text-muted">发出时间：</span>
          {order.shipped_at
            ? format(new Date(order.shipped_at), "yyyy-MM-dd HH:mm")
            : "—"}
        </div>
        <div className="sm:col-span-2">
          <span className="text-muted">整单备注：</span>
          {order.remark || "—"}
        </div>
      </div>

      <table className="mb-10 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-ink text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">款号</th>
            <th className="py-2 pr-2">颜色</th>
            <th className="py-2 pr-2">尺码</th>
            <th className="py-2 text-right">数量</th>
            <th className="py-2 pr-2">瑕疵备注</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((line, idx) => (
            <tr key={line.id} className="border-b border-line">
              <td className="py-2 pr-2">{idx + 1}</td>
              <td className="py-2 pr-2 font-medium">{line.style_no}</td>
              <td className="py-2 pr-2">{line.color}</td>
              <td className="py-2 pr-2">{line.size}</td>
              <td className="py-2 text-right tabular-nums">{line.quantity}</td>
              <td className="py-2 pr-2">
                {[line.defect_reasons.join("、"), line.defect_note]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-8 text-sm">
        <div className="border-t border-line pt-3">仓管签字：</div>
        <div className="border-t border-line pt-3">店铺签收：</div>
      </div>
    </div>
  );
}
