import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isMockPreview } from "@/lib/mock/mode";
import { mockListInventory, mockListProducts } from "@/lib/mock/store";
import {
  canEditMaster,
  canOperateStock,
  type InventoryRow,
} from "@/types/database";
import { EmptyState, PageHeader, Button, Input, Select } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { ProductForm } from "@/components/ProductForm";
import { ProductExcelImport } from "@/components/ProductExcelImport";
import { InventoryStoreVisibleTable } from "@/components/InventoryStoreVisibleTable";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    style_no?: string;
    brand?: string;
    category?: string;
    show_archived?: string;
  }>;
}) {
  const sp = await searchParams;
  const showArchived = sp.show_archived === "1" || sp.show_archived === "true";
  const current = await getCurrentUser();
  const canStock = canOperateStock(current?.profile?.role);
  const canMaster = canEditMaster(current?.profile?.role);
  let rows: InventoryRow[] = [];
  let brands: string[] = [];
  let categories: string[] = [];
  let errorMsg = "";

  if (isMockPreview()) {
    rows = mockListInventory({
      style_no: sp.style_no,
      brand: sp.brand,
      category: sp.category,
      show_archived: showArchived,
    });
    const products = mockListProducts();
    brands = Array.from(new Set(products.map((p) => p.brand))).sort();
    categories = Array.from(new Set(products.map((p) => p.category))).sort();
  } else {
    const supabase = await createClient();
    const { fetchInventory } = await import("@/lib/db/queries");
    const result = await fetchInventory(supabase, {
      style_no: sp.style_no,
      brand: sp.brand,
      category: sp.category,
      show_archived: showArchived,
    });
    if (result.error) errorMsg = result.error;
    rows = result.rows;
    brands = Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))).sort();
    categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort();
  }

  const exportRows = rows.map((r) => ({
    品牌: r.brand,
    款号: r.style_no,
    品名: r.product_name,
    类别: r.category,
    颜色: r.color,
    尺码: r.size,
    库存: r.quantity,
    零售价: r.retail_price,
    ...(showArchived ? { 状态: r.deleted_at ? "已归档" : "正常" } : {}),
  }));

  const filterQs = new URLSearchParams();
  if (sp.style_no) filterQs.set("style_no", sp.style_no);
  if (sp.brand) filterQs.set("brand", sp.brand);
  if (sp.category) filterQs.set("category", sp.category);
  const archivedOffHref = `/inventory${filterQs.toString() ? `?${filterQs}` : ""}`;
  filterQs.set("show_archived", "1");
  const archivedOnHref = `/inventory?${filterQs.toString()}`;

  return (
    <div>
      <PageHeader
        title="库存与建档"
        description="上半区新增 / Excel 导入；下半区库存总表支持【对门店可见】与 SKU 批量删除/归档（有流水归档，无流水删除）。"
        actions={
          <ExportButton
            rows={exportRows}
            sheetName="库存"
            fileName={`库存总表_${new Date().toISOString().slice(0, 10)}.xlsx`}
          />
        }
      />

      {canMaster ? (
        <section
          id="create"
          className="mb-10 border border-line bg-surface p-4 md:p-6"
        >
          <div className="mb-4 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
                新增商品
              </h2>
              <p className="mt-1 text-sm text-muted">
                建档后可在下方库存表看到对应颜色尺码；多图请到商品档案续传。
              </p>
            </div>
            <ProductExcelImport />
          </div>
          <ProductForm
            mode="create"
            canEdit
            compact
            redirectTo="/inventory"
          />
        </section>
      ) : (
        <p className="mb-8 text-sm text-muted">
          当前角色不可新增 / 导入商品档案；可查看与调整下方库存（若有权限）。
        </p>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {showArchived ? "已归档 SKU" : "库存总表"}
          </h2>
          <Link
            href={showArchived ? archivedOffHref : archivedOnHref}
            className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm ${
              showArchived
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 rounded-sm border ${
                showArchived ? "border-white bg-white" : "border-ink bg-transparent"
              }`}
              aria-hidden
            />
            显示已归档SKU
          </Link>
        </div>

        <form className="mb-6 grid gap-3 sm:grid-cols-4" method="get">
          {showArchived ? <input type="hidden" name="show_archived" value="1" /> : null}
          <Input name="style_no" defaultValue={sp.style_no ?? ""} placeholder="款号" />
          <Select name="brand" defaultValue={sp.brand ?? ""}>
            <option value="">全部品牌</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select name="category" defaultValue={sp.category ?? ""}>
            <option value="">全部类别</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            筛选
          </Button>
        </form>

        {errorMsg ? (
          <p className="text-sm text-red-700">{errorMsg}</p>
        ) : !rows.length ? (
          <EmptyState>
            {showArchived ? "暂无已归档 SKU" : "暂无库存数据"}
          </EmptyState>
        ) : (
          <InventoryStoreVisibleTable
            rows={rows}
            canStock={canStock}
            canMaster={canMaster}
            showArchived={showArchived}
          />
        )}
      </section>
    </div>
  );
}
