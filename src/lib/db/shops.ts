/**
 * 合作店铺 shops 表访问层。
 * 不改动 clothing_styles / skus / stock_in 与三个出入库 RPC。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  shopKindToType,
  shopTypeToKind,
  type Shop,
  type ShopKind,
  type ShopType,
} from "@/types/database";

export type ShopRow = {
  shop_code: string;
  shop_name: string;
  type: ShopType | string;
  parent_shop_id: string | null;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  remark: string | null;
  created_at: string;
  deleted_at: string | null;
};

export function mapShopRow(row: ShopRow): Shop {
  const kind = shopTypeToKind(row.type);
  return {
    id: row.shop_code,
    code: row.shop_code,
    name: row.shop_name,
    contact_name: row.contact_person,
    phone: row.phone,
    address: row.address,
    remark: row.remark,
    is_active: !row.deleted_at,
    created_at: row.created_at,
    parent_id: row.parent_shop_id,
    shop_kind: kind,
    shop_type: kind === "branch" ? "下属门店" : "独立店铺",
    deleted_at: row.deleted_at,
  };
}

export async function fetchShops(
  supabase: SupabaseClient,
  opts?: { includeArchived?: boolean; activeOnly?: boolean },
): Promise<{ rows: Shop[]; error?: string }> {
  let query = supabase
    .from("shops")
    .select(
      "shop_code, shop_name, type, parent_shop_id, contact_person, phone, address, remark, created_at, deleted_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (opts?.activeOnly || !opts?.includeArchived) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    const hint = /Could not find the table|schema cache/i.test(error.message)
      ? "请先执行 supabase/migrations/008_shops_and_stock_out_shop_id.sql"
      : undefined;
    return { rows: [], error: hint ? `${error.message}（${hint}）` : error.message };
  }
  return { rows: (data ?? []).map((r) => mapShopRow(r as ShopRow)) };
}

export async function fetchShopByCode(
  supabase: SupabaseClient,
  shopCode: string,
): Promise<Shop | null> {
  const { data, error } = await supabase
    .from("shops")
    .select(
      "shop_code, shop_name, type, parent_shop_id, contact_person, phone, address, remark, created_at, deleted_at",
    )
    .eq("shop_code", shopCode)
    .maybeSingle();
  if (error || !data) return null;
  return mapShopRow(data as ShopRow);
}

export async function saveShop(
  supabase: SupabaseClient,
  input: {
    code: string;
    name: string;
    contact_name?: string | null;
    phone?: string | null;
    address?: string | null;
    remark?: string | null;
    shop_kind?: ShopKind;
    shop_type?: ShopType;
    parent_id?: string | null;
  },
  existingCode?: string,
): Promise<Shop> {
  const type =
    input.shop_type ??
    shopKindToType(input.shop_kind) ??
    "独立店铺";
  const parent =
    type === "下属门店" ? input.parent_id?.trim() || null : null;
  if (type === "下属门店" && !parent) {
    throw new Error("下属门店必须绑定父级独立店铺");
  }

  const row = {
    shop_code: input.code.trim(),
    shop_name: input.name.trim(),
    type,
    parent_shop_id: parent,
    contact_person: input.contact_name?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    remark: input.remark?.trim() || null,
  };

  if (existingCode) {
    if (existingCode !== row.shop_code) {
      throw new Error("店铺编码不可修改");
    }
    const { data, error } = await supabase
      .from("shops")
      .update({
        shop_name: row.shop_name,
        type: row.type,
        parent_shop_id: row.parent_shop_id,
        contact_person: row.contact_person,
        phone: row.phone,
        address: row.address,
        remark: row.remark,
      })
      .eq("shop_code", existingCode)
      .select(
        "shop_code, shop_name, type, parent_shop_id, contact_person, phone, address, remark, created_at, deleted_at",
      )
      .single();
    if (error) throw error;
    return mapShopRow(data as ShopRow);
  }

  const { data, error } = await supabase
    .from("shops")
    .insert(row)
    .select(
      "shop_code, shop_name, type, parent_shop_id, contact_person, phone, address, remark, created_at, deleted_at",
    )
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("店铺编码已存在");
    throw error;
  }
  return mapShopRow(data as ShopRow);
}

/** 批量软归档；有关联出库单的店铺也只归档、不物理删除 */
export async function batchArchiveShops(
  supabase: SupabaseClient,
  shopCodes: string[],
): Promise<{ archived: number; blocked: string[] }> {
  if (!shopCodes.length) return { archived: 0, blocked: [] };
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("shops")
    .update({ deleted_at: now })
    .in("shop_code", shopCodes)
    .is("deleted_at", null)
    .select("shop_code");
  if (error) throw error;
  return { archived: data?.length ?? 0, blocked: [] };
}

/** 批量恢复归档店铺 */
export async function batchRestoreShops(
  supabase: SupabaseClient,
  shopCodes: string[],
): Promise<{ restored: number }> {
  if (!shopCodes.length) return { restored: 0 };
  const { data, error } = await supabase
    .from("shops")
    .update({ deleted_at: null })
    .in("shop_code", shopCodes)
    .not("deleted_at", "is", null)
    .select("shop_code");
  if (error) throw error;
  return { restored: data?.length ?? 0 };
}

/** 发货：下属门店收货地址取父店；备注带【来源门店：名称】 */
export function resolveShipmentShipTo(
  shop: Shop,
  shops: Shop[],
): {
  shipTo: Shop;
  sourceShop: Shop | null;
  sourceNote: string | null;
  customerName: string;
} {
  const isBranch =
    shop.shop_type === "下属门店" || shop.shop_kind === "branch";
  if (isBranch && shop.parent_id) {
    const parent =
      shops.find((s) => s.id === shop.parent_id || s.code === shop.parent_id) ??
      null;
    if (parent) {
      return {
        shipTo: parent,
        sourceShop: shop,
        sourceNote: `【来源门店：${shop.name}】`,
        customerName: shop.name,
      };
    }
  }
  return {
    shipTo: shop,
    sourceShop: null,
    sourceNote: null,
    customerName: shop.name,
  };
}

export function composeShipmentRemark(
  userRemark: string | null | undefined,
  sourceNote: string | null,
): string | null {
  const parts = [userRemark?.trim() || null, sourceNote].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}
