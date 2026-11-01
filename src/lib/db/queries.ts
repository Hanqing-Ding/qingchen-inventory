import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryRow,
  ProductWithSkus,
  Shop,
  StockMovementRow,
} from "@/types/database";
import {
  DEFAULT_CUSTOMER_SHOP,
  mapInventoryRow,
  mapStyleWithSkus,
  stockInToMovement,
  stockOutToMovement,
  type ClothingStyleRow,
  type SkuRow,
  type StockInRow,
  type StockOutRow,
} from "@/lib/db/tables";

const SKU_STYLE_SELECT =
  "id, style_id, color, size, cost_price, sell_price, current_stock, deleted_at, clothing_styles(*)";

export async function fetchStylesWithSkus(
  supabase: SupabaseClient,
  opts?: { q?: string; brand?: string; category?: string; id?: string; limit?: number },
): Promise<{ rows: ProductWithSkus[]; error?: string }> {
  let query = supabase
    .from("clothing_styles")
    .select("*, skus(*)")
    .order("updated_at", { ascending: false })
    .limit(opts?.limit ?? 200);

  if (opts?.id) query = query.eq("id", opts.id);
  if (opts?.q?.trim()) query = query.ilike("style_no", `%${opts.q.trim()}%`);
  if (opts?.brand?.trim()) query = query.ilike("supplier", `%${opts.brand.trim()}%`);
  if (opts?.category?.trim()) query = query.eq("category", opts.category.trim());

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  const rows = (data ?? []).map((row) =>
    mapStyleWithSkus(row as ClothingStyleRow & { skus?: SkuRow[] | null }),
  );
  return { rows };
}

export async function fetchInventory(
  supabase: SupabaseClient,
  opts?: {
    style_no?: string;
    brand?: string;
    category?: string;
    /** true = 仅展示已归档 SKU；默认过滤 deleted_at 非空 */
    show_archived?: boolean;
  },
): Promise<{ rows: InventoryRow[]; error?: string }> {
  let query = supabase
    .from("skus")
    .select(SKU_STYLE_SELECT)
    .order("style_id")
    .limit(2000);

  if (opts?.show_archived) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    const hint = /deleted_at/i.test(error.message)
      ? "请先在 Supabase SQL Editor 执行 supabase/migrations/007_skus_deleted_at.sql"
      : undefined;
    return { rows: [], error: hint ? `${error.message}（${hint}）` : error.message };
  }

  let rows = (data ?? []).map((row) =>
    mapInventoryRow(
      row as SkuRow & {
        clothing_styles: ClothingStyleRow | ClothingStyleRow[] | null;
      },
    ),
  );

  if (opts?.style_no?.trim()) {
    const q = opts.style_no.trim().toLowerCase();
    rows = rows.filter((r) => r.style_no.toLowerCase().includes(q));
  }
  if (opts?.brand?.trim()) {
    const q = opts.brand.trim().toLowerCase();
    rows = rows.filter((r) => r.brand.toLowerCase().includes(q));
  }
  if (opts?.category?.trim()) {
    const q = opts.category.trim();
    rows = rows.filter((r) => r.category === q);
  }

  rows.sort((a, b) =>
    `${a.style_no}|${a.color}|${a.size}`.localeCompare(`${b.style_no}|${b.color}|${b.size}`, "zh"),
  );
  return { rows };
}

export async function fetchMovements(
  supabase: SupabaseClient,
  opts?: {
    ref_no?: string;
    style_no?: string;
    shop_id?: string;
    movement_type?: string;
  },
): Promise<{ rows: StockMovementRow[]; error?: string }> {
  const skuEmbed =
    "skus(id, color, size, current_stock, clothing_styles(style_no, name, category, supplier))";

  const [inRes, outRes] = await Promise.all([
    supabase
      .from("stock_in")
      .select(`id, sku_id, quantity, batch_no, in_time, operator, remark, ${skuEmbed}`)
      .order("in_time", { ascending: false })
      .limit(500),
    supabase
      .from("stock_out")
      .select(
        `id, sku_id, quantity, order_no, customer, express_no, out_time, operator, remark, ${skuEmbed}`,
      )
      .order("out_time", { ascending: false })
      .limit(500),
  ]);

  if (inRes.error) return { rows: [], error: inRes.error.message };
  if (outRes.error) return { rows: [], error: outRes.error.message };

  let rows: StockMovementRow[] = [
    ...(inRes.data ?? []).map((r) => stockInToMovement(r as unknown as StockInRow)),
    ...(outRes.data ?? []).map((r) => stockOutToMovement(r as unknown as StockOutRow)),
  ];

  if (opts?.ref_no?.trim()) {
    const q = opts.ref_no.trim().toLowerCase();
    rows = rows.filter((r) => (r.ref_no ?? "").toLowerCase().includes(q));
  }
  if (opts?.style_no?.trim()) {
    const q = opts.style_no.trim().toLowerCase();
    rows = rows.filter((r) => r.style_no.toLowerCase().includes(q));
  }
  if (opts?.shop_id?.trim() && opts.shop_id !== DEFAULT_CUSTOMER_SHOP.id) {
    // 无 shops 表：按客户名过滤（id 即客户名编码时无效则忽略）
    rows = rows.filter((r) => (r.shop_name ?? "").includes(opts.shop_id!.trim()));
  }
  if (opts?.movement_type?.trim()) {
    rows = rows.filter((r) => r.movement_type === opts.movement_type);
  }

  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { rows };
}

export async function fetchShipmentGroups(supabase: SupabaseClient): Promise<{
  rows: {
    id: string;
    order_no: string;
    status: string;
    submitted_at: string | null;
    created_at: string;
    shops: { name?: string; code?: string } | null;
  }[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("stock_out")
    .select("id, order_no, customer, out_time, remark")
    .not("order_no", "is", null)
    .order("out_time", { ascending: false })
    .limit(500);
  if (error) return { rows: [], error: error.message };

  const map = new Map<
    string,
    {
      id: string;
      order_no: string;
      status: string;
      submitted_at: string | null;
      created_at: string;
      shops: { name?: string; code?: string } | null;
    }
  >();

  for (const row of data ?? []) {
    const orderNo = row.order_no as string;
    if (!orderNo || map.has(orderNo)) continue;
    map.set(orderNo, {
      id: orderNo,
      order_no: orderNo,
      status: "submitted",
      submitted_at: row.out_time as string,
      created_at: row.out_time as string,
      shops: { name: (row.customer as string) || "默认客户", code: "" },
    });
  }

  return { rows: Array.from(map.values()) };
}

export async function fetchShipmentPrint(
  supabase: SupabaseClient,
  orderNo: string,
): Promise<{
  orderNo: string;
  status: string;
  remark: string | null;
  createdAt: string;
  submittedAt: string | null;
  shipLabel: string;
  shop: {
    name?: string;
    code?: string;
    contact_name?: string;
    phone?: string;
    address?: string;
  } | null;
  operatorName: string;
  lines: {
    brand: string;
    style_no: string;
    name: string;
    color: string;
    size: string;
    quantity: number;
    image_url?: string | null;
  }[];
} | null> {
  const { data, error } = await supabase
    .from("stock_out")
    .select(
      "quantity, order_no, customer, shop_id, out_time, operator, remark, skus(color, size, clothing_styles(style_no, name, supplier, cover_img))",
    )
    .eq("order_no", orderNo);
  if (error || !data?.length) return null;

  const first = data[0];
  let shipLabel = "发往店铺";
  let shopInfo: {
    name?: string;
    code?: string;
    contact_name?: string;
    phone?: string;
    address?: string;
  } = { name: (first.customer as string) || "默认客户", code: "" };

  const shopId = (first.shop_id as string | null) ?? null;
  if (shopId) {
    const { fetchShopByCode, resolveShipmentShipTo } = await import("@/lib/db/shops");
    const shop = await fetchShopByCode(supabase, shopId);
    if (shop) {
      let parent: Shop | null = null;
      if (shop.parent_id) {
        parent = await fetchShopByCode(supabase, shop.parent_id);
      }
      const resolved = resolveShipmentShipTo(
        shop,
        parent ? [shop, parent] : [shop],
      );
      shipLabel = resolved.sourceShop ? "收货总部" : "发往店铺";
      shopInfo = {
        name: resolved.shipTo.name,
        code: resolved.shipTo.code,
        contact_name: resolved.shipTo.contact_name ?? undefined,
        phone: resolved.shipTo.phone ?? undefined,
        address: resolved.shipTo.address ?? undefined,
      };
    }
  }

  return {
    orderNo,
    status: "submitted",
    remark: (first.remark as string) ?? null,
    createdAt: first.out_time as string,
    submittedAt: first.out_time as string,
    shipLabel,
    shop: shopInfo,
    operatorName: (first.operator as string) || "—",
    lines: data.map((row) => {
      const skuRaw = row.skus as unknown;
      const sku = (Array.isArray(skuRaw) ? skuRaw[0] : skuRaw) as {
        color?: string;
        size?: string;
        clothing_styles?:
          | {
              style_no?: string;
              name?: string;
              supplier?: string;
              cover_img?: string;
            }
          | {
              style_no?: string;
              name?: string;
              supplier?: string;
              cover_img?: string;
            }[]
          | null;
      } | null;
      const styleRaw = sku?.clothing_styles;
      const style = Array.isArray(styleRaw) ? styleRaw[0] : styleRaw;
      return {
        brand: style?.supplier?.trim() || "青陈",
        style_no: style?.style_no ?? "",
        name: style?.name ?? "",
        color: sku?.color ?? "",
        size: sku?.size ?? "",
        quantity: row.quantity as number,
        image_url: style?.cover_img ?? null,
      };
    }),
  };
}

/** 优先读 shops 表；表未部署时回退为 stock_out.customer 列表 */
export async function fetchCustomerShops(supabase: SupabaseClient): Promise<Shop[]> {
  const { fetchShops } = await import("@/lib/db/shops");
  const live = await fetchShops(supabase, { activeOnly: true });
  if (!live.error && live.rows.length) return live.rows;
  if (live.error && !/Could not find the table|schema cache/i.test(live.error)) {
    // shops 已存在但查询失败：仍尝试返回空并让页面展示 error
    return [];
  }

  const { data } = await supabase
    .from("stock_out")
    .select("customer")
    .not("customer", "is", null)
    .limit(200);

  const names = Array.from(
    new Set(
      (data ?? [])
        .map((r) => (r.customer as string | null)?.trim())
        .filter((n): n is string => Boolean(n) && n !== "库存调整"),
    ),
  );

  const shops: Shop[] = [
    { ...DEFAULT_CUSTOMER_SHOP },
    ...names
      .filter((n) => n !== DEFAULT_CUSTOMER_SHOP.name)
      .map((name, idx) => ({
        id: `customer:${encodeURIComponent(name)}`,
        code: `C${idx + 1}`,
        name,
        contact_name: null,
        phone: null,
        address: null,
        remark: null,
        is_active: true,
        created_at: new Date(0).toISOString(),
        shop_kind: "independent" as const,
        shop_type: "独立店铺" as const,
      })),
  ];
  return shops;
}

export function shopDisplayName(shop: Shop | null | undefined, shopId: string): string {
  if (shop?.name) return shop.name;
  if (shopId.startsWith("customer:")) {
    try {
      return decodeURIComponent(shopId.slice("customer:".length));
    } catch {
      return shopId;
    }
  }
  return DEFAULT_CUSTOMER_SHOP.name;
}
