import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import {
  mockListReplenish,
  mockListRepair,
  mockListRepairQuarantine,
} from "@/lib/mock/store";
import {
  REPLENISH_STATUS_LABEL,
  REPAIR_STATUS_LABEL,
  type ReplenishRequest,
  type ReplenishStatus,
  type RepairOrder,
  type RepairStatus,
} from "@/types/database";
import { Button, EmptyState, PageHeader, Select } from "@/components/ui";
import { SectionTabs } from "@/components/SectionTabs";
import { format } from "date-fns";

export default async function ReplenishAndRepairPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "repair" ? "repair" : "replenish";
  const status = sp.status?.trim() || undefined;

  return (
    <div>
      <PageHeader
        title="补货与返修"
        description="补货需求与返修单据同页管理；明细与新建仍走各自流程。"
        actions={
          tab === "repair" ? (
            <Link href="/repair/new">
              <Button type="button">新建返修单</Button>
            </Link>
          ) : (
            <Link href="/replenish/new">
              <Button type="button">录入今日需求</Button>
            </Link>
          )
        }
      />

      <SectionTabs
        active={tab}
        tabs={[
          { id: "replenish", label: "补货需求", href: "/replenish?tab=replenish" },
          { id: "repair", label: "返修", href: "/replenish?tab=repair" },
        ]}
      />

      {tab === "repair" ? (
        <RepairSection status={status} />
      ) : (
        <ReplenishSection status={status} />
      )}
    </div>
  );
}

async function ReplenishSection({ status }: { status?: string }) {
  let rows: ReplenishRequest[] = [];
  const errorMsg = "";

  if (isMockPreview()) {
    rows = mockListReplenish(status) as ReplenishRequest[];
  } else {
    // 四表模式无补货需求表：列表为空，请直接使用「出库单」
    rows = [];
  }

  return (
    <div>
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <input type="hidden" name="tab" value="replenish" />
        <Select name="status" defaultValue={status ?? ""} className="max-w-xs">
          <option value="">全部状态</option>
          <option value="open">待拣货</option>
          <option value="shipped">已出库</option>
          <option value="cancelled">已作废</option>
        </Select>
        <Button type="submit" variant="secondary">
          筛选
        </Button>
      </form>

      {errorMsg ? (
        <p className="text-sm text-red-700">{errorMsg}</p>
      ) : !rows.length ? (
        <EmptyState>暂无补货需求</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-3">需求单号</th>
                <th className="px-3 py-3">日期</th>
                <th className="px-3 py-3">店铺</th>
                <th className="px-3 py-3">状态</th>
                <th className="px-3 py-3">创建时间</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const shop = Array.isArray(r.shops) ? r.shops[0] : r.shops;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{r.request_no}</td>
                    <td className="px-3 py-2">{r.request_date}</td>
                    <td className="px-3 py-2">
                      {(shop as { name?: string } | null)?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {REPLENISH_STATUS_LABEL[r.status as ReplenishStatus] ?? r.status}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {format(new Date(r.created_at), "MM-dd HH:mm")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/replenish/${r.id}`} className="underline">
                        {r.status === "open" ? "拣货 / 出库" : "查看"}
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

async function RepairSection({ status }: { status?: string }) {
  if (!isMockPreview()) {
    return <EmptyState>返修单据当前仅 Mock 预览可用</EmptyState>;
  }

  const rows = mockListRepair(status) as RepairOrder[];
  const quarantine = mockListRepairQuarantine();
  const quarantineTotal = quarantine.reduce((s, r) => s + r.repair_quantity, 0);

  return (
    <div>
      <div className="mb-6 border border-line bg-surface px-4 py-3 text-sm">
        <span className="text-muted">当前返修隔离库存合计：</span>
        <strong className="tabular-nums">{quarantineTotal}</strong>
        <span className="text-muted"> 件（不计入库存总表可售数量）</span>
      </div>

      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <input type="hidden" name="tab" value="repair" />
        <Select name="status" defaultValue={status ?? ""} className="max-w-xs">
          <option value="">全部状态</option>
          {(Object.keys(REPAIR_STATUS_LABEL) as RepairStatus[]).map((k) => (
            <option key={k} value={k}>
              {REPAIR_STATUS_LABEL[k]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          筛选
        </Button>
      </form>

      {!rows.length ? (
        <EmptyState>暂无返修单</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-3">返修单号</th>
                <th className="px-3 py-3">店铺</th>
                <th className="px-3 py-3">状态</th>
                <th className="px-3 py-3">来源</th>
                <th className="px-3 py-3">件数</th>
                <th className="px-3 py-3">创建</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const shop = Array.isArray(r.shops) ? r.shops[0] : r.shops;
                const qty = (r.items ?? []).reduce((s, i) => s + i.quantity, 0);
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{r.repair_no}</td>
                    <td className="px-3 py-2">
                      {(shop as { name?: string } | null)?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {REPAIR_STATUS_LABEL[r.status as RepairStatus]}
                    </td>
                    <td className="px-3 py-2">
                      {r.source === "portal" ? "店铺门户" : "后台"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{qty}</td>
                    <td className="px-3 py-2 text-muted">
                      {format(new Date(r.created_at), "MM-dd HH:mm")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/repair/${r.id}`} className="underline">
                        详情
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
