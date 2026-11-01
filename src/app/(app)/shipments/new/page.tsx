import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListShops } from "@/lib/mock/store";
import type { Shop } from "@/types/database";
import { PageHeader } from "@/components/ui";
import { ShipmentForm } from "@/components/ShipmentForm";

export default async function NewShipmentPage() {
  let shops: Shop[] = [];
  if (isMockPreview()) {
    shops = mockListShops(true);
  } else {
    const supabase = await createClient();
    const { fetchShops } = await import("@/lib/db/shops");
    const result = await fetchShops(supabase, { activeOnly: true });
    shops = result.rows;
  }

  return (
    <div>
      <PageHeader
        title="新建补货发货"
        description="先选合作店铺（零售方），再按款号录入发货数量；提交扣库存，禁止负库存。"
      />
      <ShipmentForm shops={shops} />
    </div>
  );
}
