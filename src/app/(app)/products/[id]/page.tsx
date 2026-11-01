import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isMockPreview } from "@/lib/mock/mode";
import { mockGetProduct } from "@/lib/mock/store";
import {
  canEditMaster,
  getProductImages,
  getWhiteBgImage,
  isStoreVisible,
  type ProductWithSkus,
} from "@/types/database";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";
import { ProductArchiveGallery } from "@/components/ProductArchiveGallery";
import { StoreVisibleSwitch } from "@/components/StoreVisibleSwitch";

export default async function ProductArchivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentUser();
  const canEdit = canEditMaster(current?.profile?.role);

  let product: ProductWithSkus | null = null;

  if (isMockPreview()) {
    product = mockGetProduct(id);
  } else {
    const supabase = await createClient();
    const { fetchStylesWithSkus } = await import("@/lib/db/queries");
    const { rows } = await fetchStylesWithSkus(supabase, { id, limit: 1 });
    product = rows[0] ?? null;
  }

  if (!product) notFound();

  const images = getProductImages(product);
  const whiteBgUrl = getWhiteBgImage(product);
  const colors = Array.from(new Set(product.product_skus.map((s) => s.color)));
  const sizes = Array.from(new Set(product.product_skus.map((s) => s.size)));

  return (
    <div>
      <PageHeader
        title={product.style_no}
        description={`${product.brand} · ${product.name} · ${product.category}`}
        actions={
          <Link href="/products" className="text-sm underline">
            返回档案列表
          </Link>
        }
      />

      <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ProductArchiveGallery
          productId={product.id}
          styleNo={product.style_no}
          images={images}
          whiteBgUrl={whiteBgUrl}
          canEdit={canEdit}
        />

        <aside className="space-y-6 border border-line bg-surface p-5 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted">基础信息</div>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">款号</dt>
                <dd className="font-medium">{product.style_no}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">品牌</dt>
                <dd>{product.brand}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">品名</dt>
                <dd>{product.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">品类</dt>
                <dd>{product.category}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">季节</dt>
                <dd>{product.season || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">零售价</dt>
                <dd className="tabular-nums">¥{Number(product.retail_price).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">成分</dt>
                <dd className="text-right">{product.composition || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">颜色</dt>
                <dd className="text-right">{colors.join("、") || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">尺码</dt>
                <dd className="text-right">{sizes.join("、") || "—"}</dd>
              </div>
            </dl>
          </div>

          <StoreVisibleSwitch
            productId={product.id}
            storeVisible={isStoreVisible(product)}
            canEdit={canEdit}
          />

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
              颜色 / 尺码 / 可售库存
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1">颜色</th>
                  <th className="py-1">尺码</th>
                  <th className="py-1 text-right">库存</th>
                </tr>
              </thead>
              <tbody>
                {product.product_skus.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-1.5">{s.color}</td>
                    <td className="py-1.5">{s.size}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!canEdit ? (
              <p className="mt-3 text-xs text-muted">只读查看；合作店铺门户同样可下载样图。</p>
            ) : null}
          </div>
        </aside>
      </div>

      {canEdit ? (
        <section className="border-t border-line pt-8">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl tracking-wide">
            编辑档案信息
          </h2>
          <ProductForm
            mode="edit"
            product={product}
            canEdit
            hideImageField
            redirectTo={`/products/${product.id}`}
          />
        </section>
      ) : null}
    </div>
  );
}
