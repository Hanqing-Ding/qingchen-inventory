import { isMockPreview } from "@/lib/mock/mode";
import {
  mockRepairDashboardStats,
  mockSalesHotStats,
} from "@/lib/mock/store";
import { REPAIR_STATUS_LABEL, type RepairStatus } from "@/types/database";
import { EmptyState, PageHeader } from "@/components/ui";

/** 销售看板：爆款统计与返修模块彼此独立，不混算 */
export default function DashboardPage() {
  if (!isMockPreview()) {
    return (
      <div>
        <PageHeader title="看板" />
        <EmptyState>仅 Mock 预览可用</EmptyState>
      </div>
    );
  }

  const sales = mockSalesHotStats();
  const repair = mockRepairDashboardStats();
  const maxReason = Math.max(1, ...repair.reasonDistribution.map((r) => r.qty));

  return (
    <div>
      <PageHeader
        title="看板"
        description="正常出库爆款与返修数据分区展示；返修进出不计入销量统计。"
      />

      <section className="mb-10">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-2xl tracking-wide">
          本月出库爆款
        </h2>
        <p className="mb-4 text-sm text-muted">
          {sales.month} · 仅统计正常发货流水，已排除返修发货
        </p>
        {!sales.hotStyles.length ? (
          <EmptyState>本月暂无正常出库数据</EmptyState>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">款号</th>
                  <th className="px-3 py-3">品名</th>
                  <th className="px-3 py-3 text-right">出库件数</th>
                </tr>
              </thead>
              <tbody>
                {sales.hotStyles.map((row, idx) => (
                  <tr key={row.style_no} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-muted">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{row.style_no}</td>
                    <td className="px-3 py-2">{row.product_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-line bg-surface p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-2xl tracking-wide">
          本月返修
        </h2>
        <p className="mb-5 text-sm text-muted">
          {repair.month} · 独立模块，不与上方爆款混计
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="border border-line bg-background px-4 py-3">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">返修单数</div>
            <div className="mt-1 text-3xl tabular-nums">{repair.orderCount}</div>
          </div>
          <div className="border border-line bg-background px-4 py-3">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">返修总量</div>
            <div className="mt-1 text-3xl tabular-nums">{repair.totalQty}</div>
            <div className="text-xs text-muted">件</div>
          </div>
          <div className="border border-line bg-background px-4 py-3">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">进行中</div>
            <div className="mt-1 text-3xl tabular-nums">
              {(repair.byStatus.pending_receive ?? 0) +
                (repair.byStatus.received ?? 0) +
                (repair.byStatus.repairing ?? 0) +
                (repair.byStatus.repaired_pending_ship ?? 0)}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-3 text-xs uppercase tracking-[0.14em] text-muted">
            返修原因分布
          </div>
          {!repair.reasonDistribution.length ? (
            <p className="text-sm text-muted">暂无数据</p>
          ) : (
            <ul className="space-y-2">
              {repair.reasonDistribution.map((r) => (
                <li key={r.reason} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0">{r.reason}</span>
                  <div className="h-2 flex-1 bg-background">
                    <div
                      className="h-2 bg-ink"
                      style={{ width: `${Math.round((r.qty / maxReason) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted">{r.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {Object.keys(repair.byStatus).length ? (
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
              状态构成
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {(Object.entries(repair.byStatus) as [RepairStatus, number][]).map(
                ([st, n]) => (
                  <span key={st} className="border border-line px-2 py-1">
                    {REPAIR_STATUS_LABEL[st]} {n}
                  </span>
                ),
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
