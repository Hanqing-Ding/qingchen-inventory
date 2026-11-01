import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListShops } from "@/lib/mock/store";
import type { Shop } from "@/types/database";
import { PageHeader } from "@/components/ui";
import { ReplenishCreateForm } from "@/components/ReplenishCreateForm";

export default async function NewReplenishPage() {
  let shops: Shop[] = [];
  if (isMockPreview()) {
    shops = mockListShops(true);
  } else {
    const supabase = await createClient();
    const { fetchCustomerShops } = await import("@/lib/db/queries");
    shops = await fetchCustomerShops(supabase);
  }

  return (
    <div>
      <PageHeader
        title="录入补货需求"
        description="选择合作店铺，按款号/颜色/尺码/数量录入今日需求，提交后仓库可见。"
      />
      <ReplenishCreateForm shops={shops} />
    </div>
  );
}
