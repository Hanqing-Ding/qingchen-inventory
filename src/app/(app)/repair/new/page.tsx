import Link from "next/link";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListShops } from "@/lib/mock/store";
import { PageHeader, EmptyState } from "@/components/ui";
import { RepairCreateForm } from "@/components/RepairCreateForm";

export default function RepairNewPage() {
  if (!isMockPreview()) {
    return (
      <div>
        <PageHeader title="新建返修单" />
        <EmptyState>仅 Mock 预览可用</EmptyState>
      </div>
    );
  }

  const shops = mockListShops(true).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
  }));

  return (
    <div>
      <PageHeader
        title="新建返修单"
        description="绑定店铺与瑕疵明细；创建后为「待签收」。也可由店铺门户提交。"
        actions={
          <Link href="/replenish?tab=repair" className="text-sm underline">
            返回列表
          </Link>
        }
      />
      <RepairCreateForm shops={shops} />
    </div>
  );
}
