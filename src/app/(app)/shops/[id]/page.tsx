import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockGetShop, mockListHqShops, mockListShops } from "@/lib/mock/store";
import { SHOP_KIND_LABEL, type Shop } from "@/types/database";
import { PageHeader } from "@/components/ui";
import { ShopForm } from "@/components/ShopForm";
import { ShopPortalPanel } from "@/components/ShopPortalPanel";

export default async function EditShopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  let shop: Shop | null = null;
  let parentOptions: { id: string; name: string; code: string }[] = [];
  let children: Shop[] = [];

  if (isMockPreview()) {
    shop = mockGetShop(id);
    parentOptions = mockListHqShops()
      .filter((s) => s.shop_kind !== "branch")
      .map((s) => ({ id: s.id, name: s.name, code: s.code }));
    children = mockListShops().filter((s) => s.parent_id === id);
  } else {
    const supabase = await createClient();
    const { fetchShopByCode, fetchShops } = await import("@/lib/db/shops");
    shop = await fetchShopByCode(supabase, id);
    const { rows } = await fetchShops(supabase, { activeOnly: true });
    parentOptions = rows
      .filter((s) => s.shop_type !== "下属门店" && s.shop_kind !== "branch")
      .map((s) => ({ id: s.id, name: s.name, code: s.code }));
    children = rows.filter((s) => s.parent_id === id);
  }

  if (!shop || shop.deleted_at) notFound();

  const kindLabel =
    shop.shop_type ??
    (shop.shop_kind ? SHOP_KIND_LABEL[shop.shop_kind] : "店铺");

  return (
    <div>
      <PageHeader
        title="编辑合作店铺"
        description={`${kindLabel} · 编码 ${shop.code}${
          shop.parent_id ? " · 已绑定父店" : ""
        }`}
      />
      {isMockPreview() ? <ShopPortalPanel shop={shop} /> : null}
      {children.length ? (
        <div className="mb-8 border border-line bg-surface p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">下属门店</div>
          <ul className="mt-2 space-y-1">
            {children.map((c) => (
              <li key={c.id}>
                {c.name}（{c.code}）
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ShopForm shop={shop} parentOptions={parentOptions} />
    </div>
  );
}
