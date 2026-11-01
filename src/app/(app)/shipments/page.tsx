import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListShipments } from "@/lib/mock/store";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { format } from "date-fns";

export default async function ShipmentsPage() {
  type Row = {
    id: string;
    order_no: string;
    status: string;
    submitted_at: string | null;
    created_at: string;
    shops: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
  };

  let data: Row[] = [];
  let errorMsg = "";

  if (isMockPreview()) {
    data = mockListShipments().map((s) => ({
      id: s.id,
      order_no: s.order_no,
      status: s.status,
      submitted_at: s.submitted_at,
      created_at: s.created_at,
      shops: s.shops ?? null,
    }));
  } else {
    const supabase = await createClient();
    const { fetchShipmentGroups } = await import("@/lib/db/queries");
    const result = await fetchShipmentGroups(supabase);
    if (result.error) errorMsg = result.error;
    data = result.rows;
  }

  return (
    <div>
      <PageHeader
        title="出库单"
        description="由补货需求拣货完成后生成；也可手工新建。可打印给仓库打包。"
        actions={
          <>
            <Link href="/shops">
              <Button type="button" variant="secondary">
                合作店铺
              </Button>
            </Link>
            <Link href="/shipments/new">
              <Button type="button">新建发货单</Button>
            </Link>
          </>
        }
      />

      {errorMsg ? (
        <p className="text-sm text-red-700">{errorMsg}</p>
      ) : !data.length ? (
        <EmptyState>暂无出库单</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-3">发货单号</th>
                <th className="px-3 py-3">店铺</th>
                <th className="px-3 py-3">状态</th>
                <th className="px-3 py-3">时间</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((o) => {
                const shop = Array.isArray(o.shops) ? o.shops[0] : o.shops;
                return (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{o.order_no}</td>
                    <td className="px-3 py-2">{shop?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {o.status === "submitted" ? "已提交" : "草稿"}
                    </td>
                    <td className="px-3 py-2">
                      {format(
                        new Date(o.submitted_at ?? o.created_at),
                        "yyyy-MM-dd HH:mm",
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/shipments/${o.id}/print`} className="underline">
                        打印
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
