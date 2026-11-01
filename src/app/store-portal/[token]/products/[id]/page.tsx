import Link from "next/link";
import { isMockPreview } from "@/lib/mock/mode";
import { mockGetProduct, mockGetShopByPortalToken } from "@/lib/mock/store";
import { getProductImages, getWhiteBgImage, isStoreVisible } from "@/types/database";
import { ProductArchiveGallery } from "@/components/ProductArchiveGallery";

/** 店铺门户：只读商品档案（可打包下载样图，不可编辑） */
export default async function PortalProductArchivePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;

  if (!isMockPreview()) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
        页面暂不可用
      </main>
    );
  }

  const shop = mockGetShopByPortalToken(token);
  if (!shop || !shop.portal_enabled) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
        链接无效或已停用
      </main>
    );
  }

  const product = mockGetProduct(id);
  if (!product) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
        商品不存在
      </main>
    );
  }

  if (!isStoreVisible(product)) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
        暂无此商品
      </main>
    );
  }

  const catalog = new Set(shop.catalog_sku_ids ?? []);
  const visible = product.product_skus.some((s) => catalog.has(s.id));
  if (!visible) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-[#6b6b6b]">
        暂无此商品
      </main>
    );
  }

  const images = getProductImages(product);
  const whiteBgUrl = getWhiteBgImage(product);
  const colors = Array.from(new Set(product.product_skus.map((s) => s.color)));
  const sizes = Array.from(new Set(product.product_skus.map((s) => s.size)));

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-[#f7f7f5] px-4 py-6">
      <Link
        href={`/store-portal/${token}`}
        className="text-xs text-[#6b6b6b] underline"
      >
        ← 返回目录
      </Link>
      <header className="mt-4 mb-6">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#6b6b6b]">
          青陈时尚
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide text-[#111]">
          {product.style_no}
        </h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          {product.brand} · {product.name} · {product.category}
        </p>
      </header>

      <div className="mb-8 border border-[#e4e4e0] bg-white p-4">
        <ProductArchiveGallery
          productId={product.id}
          styleNo={product.style_no}
          images={images}
          whiteBgUrl={whiteBgUrl}
          canEdit={false}
        />
      </div>

      <div className="border border-[#e4e4e0] bg-white p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-[#6b6b6b]">颜色</dt>
            <dd>{colors.join("、")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6b6b6b]">尺码</dt>
            <dd>{sizes.join("、")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6b6b6b]">成分</dt>
            <dd className="text-right">{product.composition || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
