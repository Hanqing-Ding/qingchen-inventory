import { isMockPreview } from "@/lib/mock/mode";
import { mockGetPortalCatalog } from "@/lib/mock/store";
import { StorePortalClient } from "@/components/StorePortalClient";

export default async function StorePortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isMockPreview()) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
        页面暂不可用
      </main>
    );
  }

  try {
    const { shop, items } = mockGetPortalCatalog(token);
    return (
      <StorePortalClient
        token={token}
        shopName={shop.name}
        shopCode={shop.code}
        items={items}
      />
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "无法打开门户";
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="font-[family-name:var(--font-display)] text-3xl tracking-[0.12em]">
          青陈时尚
        </div>
        <p className="mt-6 text-sm text-[#6b6b6b]">{message}</p>
      </main>
    );
  }
}
