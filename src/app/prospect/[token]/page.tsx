import { isMockPreview } from "@/lib/mock/mode";
import { mockGetPublicShareCatalog } from "@/lib/mock/store";
import { PublicShareClient } from "@/components/PublicShareClient";

export default async function ProspectArchivePage({
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
    const { link, products } = mockGetPublicShareCatalog(token);
    if (link.type !== "prospect_archive") {
      return (
        <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
          链接无效
        </main>
      );
    }
    return (
      <PublicShareClient
        mode="prospect_archive"
        title={link.title}
        watermark={link.watermark}
        products={products}
      />
    );
  } catch (e: unknown) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
        {e instanceof Error ? e.message : "链接无效"}
      </main>
    );
  }
}
