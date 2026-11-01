import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListHqShops } from "@/lib/mock/store";
import { PageHeader } from "@/components/ui";
import { ShopForm } from "@/components/ShopForm";

export default async function NewShopPage() {
  let parentOptions: { id: string; name: string; code: string }[] = [];

  if (isMockPreview()) {
    parentOptions = mockListHqShops()
      .filter((s) => s.shop_kind !== "branch")
      .map((s) => ({ id: s.id, name: s.name, code: s.code }));
  } else {
    const supabase = await createClient();
    const { fetchShops } = await import("@/lib/db/shops");
    const { rows } = await fetchShops(supabase, { activeOnly: true });
    parentOptions = rows
      .filter((s) => s.shop_type !== "下属门店" && s.shop_kind !== "branch")
      .map((s) => ({ id: s.id, name: s.name, code: s.code }));
  }

  return (
    <div>
      <PageHeader
        title="新增合作店铺"
        description="主体类型：独立店铺 / 下属门店。下属门店须绑定父店；发货地址取父店。"
      />
      <ShopForm parentOptions={parentOptions} />
    </div>
  );
}
