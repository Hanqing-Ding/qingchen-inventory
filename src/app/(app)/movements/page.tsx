import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListMovements, mockListShops } from "@/lib/mock/store";
import type { StockMovementRow } from "@/types/database";
import { Button, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { format } from "date-fns";

const TYPE_LABEL: Record<string, string> = {
  inbound: "入库",
  shipment: "发货",
  adjust: "盘点调整",
};

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref_no?: string;
    style_no?: string;
    shop_id?: string;
    movement_type?: string;
  }>;
}) {
  const sp = await searchParams;
  let rows: StockMovementRow[] = [];
  let shops: { id: string; name: string; code: string }[] = [];
  let errorMsg = "";

  if (isMockPreview()) {
    rows = mockListMovements({
      ref_no: sp.ref_no,
      style_no: sp.style_no,
      shop_id: sp.shop_id,
      movement_type: sp.movement_type,
    });
    shops = mockListShops(true).map((s) => ({ id: s.id, name: s.name, code: s.code }));
  } else {
    const supabase = await createClient();
    const { fetchMovements, fetchCustomerShops } = await import("@/lib/db/queries");
    const [mov, shopList] = await Promise.all([
      fetchMovements(supabase, {
        ref_no: sp.ref_no,
        style_no: sp.style_no,
        shop_id: sp.shop_id,
        movement_type: sp.movement_type,
      }),
      fetchCustomerShops(supabase),
    ]);
    if (mov.error) errorMsg = mov.error;
    rows = mov.rows;
    shops = shopList.map((s) => ({ id: s.id, name: s.name, code: s.code }));
  }

  const exportRows = rows.map((r) => ({
    时间: format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
    类型: TYPE_LABEL[r.movement_type] ?? r.movement_type,
    单号: r.ref_no ?? "",
    店铺: r.shop_name ?? "",
    款号: r.style_no,
    颜色: r.color,
    尺码: r.size,
    数量: r.quantity_delta,
    变动后库存: r.quantity_after,
    操作人: r.operator_name ?? "",
  }));

  return (
    <div>
      <PageHeader
        title="库存变动流水"
        description="发货/入库等变动记录；可按单号、款号、店铺筛选并导出。"
        actions={
          <ExportButton
            rows={exportRows}
            sheetName="流水"
            fileName={`库存流水_${new Date().toISOString().slice(0, 10)}.xlsx`}
          />
        }
      />

      <form className="mb-6 grid gap-3 sm:grid-cols-5" method="get">
        <Input name="ref_no" defaultValue={sp.ref_no ?? ""} placeholder="发货/入库单号" />
        <Input name="style_no" defaultValue={sp.style_no ?? ""} placeholder="款号" />
        <Select name="shop_id" defaultValue={sp.shop_id ?? ""}>
          <option value="">全部店铺</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select name="movement_type" defaultValue={sp.movement_type ?? ""}>
          <option value="">全部类型</option>
          <option value="inbound">入库</option>
          <option value="shipment">发货</option>
          <option value="adjust">盘点调整</option>
        </Select>
        <Button type="submit" variant="secondary">
          查询
        </Button>
      </form>

      {errorMsg ? (
        <p className="text-sm text-red-700">{errorMsg}</p>
      ) : !rows.length ? (
        <EmptyState>暂无流水</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-3">时间</th>
                <th className="px-3 py-3">类型</th>
                <th className="px-3 py-3">单号</th>
                <th className="px-3 py-3">店铺</th>
                <th className="px-3 py-3">款号</th>
                <th className="px-3 py-3">颜色</th>
                <th className="px-3 py-3">尺码</th>
                <th className="px-3 py-3 text-right">数量</th>
                <th className="px-3 py-3">操作人</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}
                  </td>
                  <td className="px-3 py-2">{TYPE_LABEL[r.movement_type] ?? r.movement_type}</td>
                  <td className="px-3 py-2 font-medium">{r.ref_no}</td>
                  <td className="px-3 py-2">{r.shop_name ?? "—"}</td>
                  <td className="px-3 py-2">{r.style_no}</td>
                  <td className="px-3 py-2">{r.color}</td>
                  <td className="px-3 py-2">{r.size}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.quantity_delta}</td>
                  <td className="px-3 py-2">{r.operator_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
