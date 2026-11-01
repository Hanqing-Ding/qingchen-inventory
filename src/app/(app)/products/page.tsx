import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListProducts } from "@/lib/mock/store";
import {
  PRODUCT_SEASON_OPTIONS,
  canEditMaster,
  getProductImages,
} from "@/types/database";
import { Button, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { ProductQuickPreview } from "@/components/ProductQuickPreview";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    category?: string;
    season?: string;
  }>;
}) {
  const sp = await searchParams;
  const current = await getCurrentUser();
  const canEdit = canEditMaster(current?.profile?.role);

  type Row = {
    id: string;
    brand: string;
    style_no: string;
    name: string;
    category: string;
    season: string;
    retail_price: number;
    images: string[];
    colors: string[];
    sizes: string[];
  };

  let products: Row[] = [];
  let brands: string[] = [];
  let categories: string[] = [];
  let errorMsg = "";

  if (isMockPreview()) {
    const all = mockListProducts();
    brands = Array.from(new Set(all.map((p) => p.brand))).sort();
    categories = Array.from(new Set(all.map((p) => p.category))).sort();
    products = mockListProducts({
      q: sp.q,
      brand: sp.brand,
      category: sp.category,
      season: sp.season,
    }).map((p) => {
      const images = getProductImages(p);
      return {
        id: p.id,
        brand: p.brand,
        style_no: p.style_no,
        name: p.name,
        category: p.category,
        season: String(p.season ?? ""),
        retail_price: p.retail_price,
        images,
        colors: Array.from(new Set(p.product_skus.map((s) => s.color))),
        sizes: Array.from(new Set(p.product_skus.map((s) => s.size))),
      };
    });
  } else {
    const supabase = await createClient();
    const { fetchStylesWithSkus } = await import("@/lib/db/queries");
    const { rows, error } = await fetchStylesWithSkus(supabase, {
      q: sp.q,
      brand: sp.brand,
      category: sp.category,
    });
    if (error) errorMsg = error;
    // 四表无 season 字段；筛选参数保留 UI，实库侧忽略
    void sp.season;
    brands = Array.from(new Set(rows.map((p) => p.brand))).sort();
    categories = Array.from(new Set(rows.map((p) => p.category))).sort();
    products = rows.map((p) => {
      const images = getProductImages(p);
      return {
        id: p.id,
        brand: p.brand,
        style_no: p.style_no,
        name: p.name,
        category: p.category,
        season: String(p.season ?? ""),
        retail_price: Number(p.retail_price),
        images,
        colors: Array.from(new Set(p.product_skus.map((s) => s.color))),
        sizes: Array.from(new Set(p.product_skus.map((s) => s.size))),
      };
    });
  }

  const filterHint = [
    sp.brand ? `品牌「${sp.brand}」` : "",
    sp.category ? `品类「${sp.category}」` : "",
    sp.season ? `季节「${sp.season}」` : "",
    sp.q ? `关键词「${sp.q}」` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        title="商品档案"
        description="鼠标放在样图上即可左右滑看多图（白底图在最后）；右下角一键下载。库存/单据用白底图。支持按品牌 / 品类 / 季节筛选。"
        actions={
          canEdit ? (
            <Link href="/inventory#create">
              <Button type="button">去建档 / 导入</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-6 grid gap-3 sm:grid-cols-5" method="get" action="/products">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="款号 / 品名" />
        <Select name="brand" defaultValue={sp.brand ?? ""}>
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Select name="category" defaultValue={sp.category ?? ""}>
          <option value="">全部品类</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select name="season" defaultValue={sp.season ?? ""}>
          <option value="">全部季节</option>
          {PRODUCT_SEASON_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1">
            筛选
          </Button>
          {filterHint ? (
            <Link href="/products" className="inline-flex items-center px-2 text-sm underline">
              清除
            </Link>
          ) : null}
        </div>
      </form>

      {errorMsg ? (
        <p className="text-sm text-red-700">{errorMsg}</p>
      ) : !products.length ? (
        <EmptyState>暂无商品{filterHint ? `（${filterHint}）` : ""}</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="space-y-2">
              <ProductQuickPreview
                styleNo={p.style_no}
                name={`${p.brand} · ${p.name}`}
                images={p.images}
                href={`/products/${p.id}`}
                meta={`${p.category}${p.season ? ` · ${p.season}` : ""} · ${p.colors.join("/")} · ${p.sizes.join("/")} · ¥${Number(p.retail_price).toFixed(0)}`}
              />
              <div className="px-1 text-right">
                <Link href={`/products/${p.id}`} className="text-xs underline text-muted">
                  编辑档案 / 管理样图
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
