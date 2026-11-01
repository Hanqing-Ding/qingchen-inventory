/**
 * 对齐线上 Supabase 四表结构（clothing_styles / skus / stock_in / stock_out）。
 * UI 仍使用 Product / ProductSku 等既有类型，经本文件映射。
 */

import type {
  InventoryRow,
  Product,
  ProductSku,
  ProductWithSkus,
  StockMovementRow,
} from "@/types/database";

export type ClothingStyleRow = {
  id: string;
  style_no: string;
  name: string | null;
  category: string | null;
  supplier: string | null;
  remark: string | null;
  cover_img: string | null;
  created_at: string;
  updated_at: string;
};

export type SkuRow = {
  id: string;
  style_id: string;
  color: string;
  size: string;
  cost_price: number | null;
  sell_price: number | null;
  current_stock: number;
  deleted_at?: string | null;
};

export type StockInRow = {
  id: string;
  sku_id: string | null;
  quantity: number;
  batch_no: string | null;
  in_time: string;
  operator: string | null;
  remark: string | null;
};

export type StockOutRow = {
  id: string;
  sku_id: string | null;
  quantity: number;
  order_no: string | null;
  customer: string | null;
  express_no: string | null;
  out_time: string;
  operator: string | null;
  remark: string | null;
};

export function mapSkuRow(row: SkuRow): ProductSku {
  return {
    id: row.id,
    product_id: row.style_id,
    color: row.color,
    size: row.size,
    quantity: row.current_stock ?? 0,
    sku_barcode: null,
    deleted_at: row.deleted_at ?? null,
    created_at: "",
    updated_at: "",
  };
}

export function mapStyleToProduct(
  style: ClothingStyleRow,
  skus: SkuRow[] = [],
): Product {
  const sell = skus.find((s) => s.sell_price != null)?.sell_price;
  return {
    id: style.id,
    brand: style.supplier?.trim() || "青陈",
    style_no: style.style_no,
    name: style.name?.trim() || style.style_no,
    image_url: style.cover_img,
    image_urls: style.cover_img ? [style.cover_img] : [],
    composition: style.remark,
    category: style.category?.trim() || "未分类",
    season: "春夏",
    retail_price: Number(sell ?? 0),
    barcode: null,
    is_active: true,
    store_visible: true,
    created_by: null,
    updated_by: null,
    created_at: style.created_at,
    updated_at: style.updated_at,
  };
}

export function mapStyleWithSkus(
  style: ClothingStyleRow & { skus?: SkuRow[] | null },
  opts?: { includeArchived?: boolean },
): ProductWithSkus {
  const raw = Array.isArray(style.skus) ? style.skus : [];
  const skus = opts?.includeArchived
    ? raw
    : raw.filter((s) => !s.deleted_at);
  return {
    ...mapStyleToProduct(style, skus),
    product_skus: skus.map(mapSkuRow),
  };
}

export function mapInventoryRow(
  sku: SkuRow & { clothing_styles: ClothingStyleRow | ClothingStyleRow[] | null },
): InventoryRow {
  const styleRaw = sku.clothing_styles;
  const style = (Array.isArray(styleRaw) ? styleRaw[0] : styleRaw) as ClothingStyleRow | null;
  const product = style
    ? mapStyleToProduct(style, [sku])
    : mapStyleToProduct(
        {
          id: sku.style_id,
          style_no: "",
          name: "",
          category: "",
          supplier: null,
          remark: null,
          cover_img: null,
          created_at: "",
          updated_at: "",
        },
        [sku],
      );

  return {
    sku_id: sku.id,
    product_id: product.id,
    brand: product.brand,
    style_no: product.style_no,
    product_name: product.name,
    category: product.category,
    retail_price: product.retail_price,
    image_url: product.image_url,
    is_active: true,
    store_visible: true,
    color: sku.color,
    size: sku.size,
    quantity: sku.current_stock ?? 0,
    sku_barcode: null,
    product_barcode: null,
    deleted_at: sku.deleted_at ?? null,
  };
}

export function stockInToMovement(
  row: StockInRow & {
    skus?:
      | (SkuRow & { clothing_styles?: ClothingStyleRow | ClothingStyleRow[] | null })
      | (SkuRow & { clothing_styles?: ClothingStyleRow | ClothingStyleRow[] | null })[]
      | null;
  },
): StockMovementRow {
  const skuRaw = row.skus;
  const sku = (Array.isArray(skuRaw) ? skuRaw[0] : skuRaw) ?? null;
  const styleRaw = sku?.clothing_styles;
  const style = (Array.isArray(styleRaw) ? styleRaw[0] : styleRaw) as ClothingStyleRow | null;
  const after = (sku?.current_stock ?? 0);
  return {
    id: row.id,
    created_at: row.in_time,
    movement_type: "inbound",
    quantity_delta: row.quantity,
    quantity_after: after,
    ref_no: row.batch_no,
    remark: row.remark,
    shop_id: null,
    shop_name: null,
    shop_code: null,
    operator_id: null,
    operator_name: row.operator,
    sku_id: row.sku_id ?? "",
    color: sku?.color ?? "",
    size: sku?.size ?? "",
    style_no: style?.style_no ?? "",
    brand: style?.supplier?.trim() || "青陈",
    product_name: style?.name ?? "",
    category: style?.category ?? "",
  };
}

export function stockOutToMovement(
  row: StockOutRow & {
    skus?:
      | (SkuRow & { clothing_styles?: ClothingStyleRow | ClothingStyleRow[] | null })
      | (SkuRow & { clothing_styles?: ClothingStyleRow | ClothingStyleRow[] | null })[]
      | null;
  },
): StockMovementRow {
  const skuRaw = row.skus;
  const sku = (Array.isArray(skuRaw) ? skuRaw[0] : skuRaw) ?? null;
  const styleRaw = sku?.clothing_styles;
  const style = (Array.isArray(styleRaw) ? styleRaw[0] : styleRaw) as ClothingStyleRow | null;
  return {
    id: row.id,
    created_at: row.out_time,
    movement_type: "shipment",
    quantity_delta: -Math.abs(row.quantity),
    quantity_after: sku?.current_stock ?? 0,
    ref_no: row.order_no,
    remark: row.remark,
    shop_id: null,
    shop_name: row.customer,
    shop_code: null,
    operator_id: null,
    operator_name: row.operator,
    sku_id: row.sku_id ?? "",
    color: sku?.color ?? "",
    size: sku?.size ?? "",
    style_no: style?.style_no ?? "",
    brand: style?.supplier?.trim() || "青陈",
    product_name: style?.name ?? "",
    category: style?.category ?? "",
  };
}

/** 无 shops 表时，出库单下拉用的默认客户 */
export const DEFAULT_CUSTOMER_SHOP = {
  id: "default-customer",
  code: "DEFAULT",
  name: "默认客户",
  contact_name: null as string | null,
  phone: null as string | null,
  address: null as string | null,
  remark: null as string | null,
  is_active: true,
  created_at: new Date(0).toISOString(),
  parent_id: null as string | null,
  shop_kind: "independent" as const,
};
