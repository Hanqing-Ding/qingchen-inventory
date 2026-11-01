import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isMockPreview } from "@/lib/mock/mode";
import {
  mockListProducts,
  mockListShareLinks,
  mockListShops,
} from "@/lib/mock/store";
import { canEditMaster, type Shop } from "@/types/database";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { SectionTabs } from "@/components/SectionTabs";
import { ShareLinksManager } from "@/components/ShareLinksManager";
import { ShopsTable } from "@/components/ShopsTable";

export default async function ShopsAndSharesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; show_archived?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "shares" ? "shares" : "shops";
  const showArchived = sp.show_archived === "1" || sp.show_archived === "true";
  const current = await getCurrentUser();
  const canEdit = canEditMaster(current?.profile?.role);

  const archivedOff = `/shops?tab=shops`;
  const archivedOn = `/shops?tab=shops&show_archived=1`;

  return (
    <div>
      <PageHeader
        title="合作店铺与分享"
        description="店铺档案、门户链接与拓新样册 / 拓客档案外链同页管理。出库单下拉选择店铺；下属门店发货地址取父店。"
        actions={
          tab === "shops" ? (
            <Link href="/shops/new">
              <Button type="button">新增店铺</Button>
            </Link>
          ) : undefined
        }
      />

      <SectionTabs
        active={tab}
        tabs={[
          { id: "shops", label: "合作店铺", href: "/shops?tab=shops" },
          { id: "shares", label: "外部分享", href: "/shops?tab=shares" },
        ]}
      />

      {tab === "shares" ? (
        <SharesSection canEdit={canEdit} />
      ) : (
        <ShopsSection
          canEdit={canEdit}
          showArchived={showArchived}
          archivedOffHref={archivedOff}
          archivedOnHref={archivedOn}
        />
      )}
    </div>
  );
}

async function ShopsSection({
  canEdit,
  showArchived,
  archivedOffHref,
  archivedOnHref,
}: {
  canEdit: boolean;
  showArchived: boolean;
  archivedOffHref: string;
  archivedOnHref: string;
}) {
  let shops: Shop[] = [];
  let errorMsg = "";

  if (isMockPreview()) {
    shops = mockListShops().filter((s) =>
      showArchived ? !!s.deleted_at : !s.deleted_at,
    );
  } else {
    const supabase = await createClient();
    const { fetchShops } = await import("@/lib/db/shops");
    const result = await fetchShops(supabase, {
      includeArchived: showArchived,
      activeOnly: !showArchived,
    });
    if (result.error) errorMsg = result.error;
    shops = showArchived
      ? result.rows.filter((s) => !!s.deleted_at)
      : result.rows;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={showArchived ? archivedOffHref : archivedOnHref}
          className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm ${
            showArchived
              ? "border-ink bg-ink text-white"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          显示已归档店铺
        </Link>
      </div>

      {errorMsg ? (
        <p className="text-sm text-red-700">{errorMsg}</p>
      ) : !shops.length ? (
        <EmptyState>
          {showArchived ? "暂无已归档店铺" : "暂无合作店铺，请先新增"}
        </EmptyState>
      ) : (
        <ShopsTable shops={shops} canEdit={canEdit} showArchived={showArchived} />
      )}
    </div>
  );
}

async function SharesSection({ canEdit }: { canEdit: boolean }) {
  if (!isMockPreview()) {
    return <EmptyState>外部分享链接当前仅 Mock 预览可用</EmptyState>;
  }

  const links = mockListShareLinks();
  const products = mockListProducts();

  if (!canEdit) {
    return <p className="text-sm text-muted">当前角色不可管理外链。</p>;
  }

  return <ShareLinksManager initialLinks={links} products={products} />;
}
