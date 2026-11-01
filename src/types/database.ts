/** 角色：管理员 / 仓管 / 跟单 */
export type UserRole = "admin" | "warehouse" | "merchandiser";

export type Profile = {
  id: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

/** 店铺主体类型（落库 shops.type） */
export type ShopType = "独立店铺" | "下属门店";

/** @deprecated 兼容旧 Mock：hq≈独立店铺(可作父店)、branch=下属门店、independent=独立店铺 */
export type ShopKind = "hq" | "branch" | "independent";

export const SHOP_TYPE_LABEL: Record<ShopType, string> = {
  独立店铺: "独立店铺",
  下属门店: "下属门店",
};

export const SHOP_KIND_LABEL: Record<ShopKind, string> = {
  hq: "独立店铺",
  branch: "下属门店",
  independent: "独立店铺",
};

export function shopKindToType(kind: ShopKind | null | undefined): ShopType {
  return kind === "branch" ? "下属门店" : "独立店铺";
}

export function shopTypeToKind(type: ShopType | string | null | undefined): ShopKind {
  return type === "下属门店" || type === "branch" ? "branch" : "independent";
}

export type ShareAccessLog = {
  id: string;
  at: string;
  path?: string;
  note?: string;
};

export type Shop = {
  /** 与 shops.shop_code 相同（主键） */
  id: string;
  code: string;
  name: string;
  /** 对接人 → shops.contact_person */
  contact_name: string | null;
  phone: string | null;
  /** 收货/门店地址（下属门店发货打印时读父店地址） */
  address: string | null;
  remark: string | null;
  is_active: boolean;
  created_at: string;
  /** 父级独立店铺 shop_code；下属门店必填 */
  parent_id?: string | null;
  shop_kind?: ShopKind;
  /** 落库 shops.type */
  shop_type?: ShopType;
  /** 软归档 */
  deleted_at?: string | null;
  /** 店铺门户分享密钥（Mock / 后续可落库） */
  portal_token?: string | null;
  /** 分享链接是否启用 */
  portal_enabled?: boolean;
  /** 绑定给该店可见的 SKU id 列表（门户目录） */
  catalog_sku_ids?: string[];
  /** 门户访问日志 */
  portal_access_logs?: ShareAccessLog[];
};

/** 拓新样册 / 拓客商品档案外链（无需店铺档案） */
export type ExternalShareType = "lookbook" | "prospect_archive";

export type ExternalShareLink = {
  id: string;
  type: ExternalShareType;
  token: string;
  title: string;
  /** 对外展示的商品 id */
  product_ids: string[];
  enabled: boolean;
  created_at: string;
  watermark?: string | null;
  access_logs: ShareAccessLog[];
};

/** 店铺门户只读目录行（不含价格/成本） */
export type PortalCatalogItem = {
  sku_id: string;
  product_id: string;
  style_no: string;
  product_name: string;
  image_url: string | null;
  color: string;
  size: string;
  quantity: number;
};

/** 季节（档案筛选）：两大类 */
export type ProductSeason = "春夏" | "秋冬";

export const PRODUCT_SEASON_OPTIONS: ProductSeason[] = ["春夏", "秋冬"];

/** 将旧季节值（春/夏/秋/冬/四季）归一到春夏 / 秋冬 */
export function normalizeProductSeason(
  value: string | null | undefined,
): ProductSeason {
  const v = (value ?? "").trim();
  if (v === "春夏" || v === "秋冬") return v;
  if (v === "春" || v === "夏" || v === "四季") return "春夏";
  if (v === "秋" || v === "冬") return "秋冬";
  return "春夏";
}

export type Product = {
  id: string;
  brand: string;
  style_no: string;
  name: string;
  /**
   * 白底图：库存总表、补货/出库/返修等表单缩略图使用。
   * 兼容旧字段名 image_url。
   */
  image_url: string | null;
  /**
   * 商品档案样图（一款多图）。约定顺序：其他图在前，白底图固定在最后一张。
   */
  image_urls?: string[];
  composition: string | null;
  category: string;
  /** 季节：春夏 / 秋冬 */
  season?: ProductSeason | string | null;
  retail_price: number;
  barcode: string | null;
  is_active: boolean;
  /**
   * 对门店可见（全局）：开启后店铺门户/拓新样册/拓客档案外链可见该款；
   * 关闭后所有外链隐藏，仅后台内部可见。不影响历史单据与看板统计。
   */
  store_visible?: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** 默认对门店可见 */
export function isStoreVisible(p: { store_visible?: boolean | null }): boolean {
  return p.store_visible !== false;
}

/** 白底图（库存/表单用） */
export function getWhiteBgImage(p: {
  image_url?: string | null;
  image_urls?: string[] | null;
}): string | null {
  if (p.image_url) return p.image_url;
  if (p.image_urls?.length) return p.image_urls[p.image_urls.length - 1] ?? null;
  return null;
}

/**
 * 组装存库字段：其他样图在前，白底图在最后；image_url 恒为白底图。
 */
export function buildProductImages(
  whiteBg: string | null | undefined,
  others: string[] = [],
): { image_url: string | null; image_urls: string[] } {
  const white = whiteBg?.trim() || null;
  const rest = others.map((u) => u.trim()).filter((u) => u && u !== white);
  const image_urls = white ? [...rest, white] : rest;
  return { image_url: white, image_urls };
}

/** 商品档案样图（白底图排在最后） */
export function getProductImages(p: {
  image_url?: string | null;
  image_urls?: string[] | null;
}): string[] {
  const white = p.image_url?.trim() || null;
  const raw = (p.image_urls?.length ? p.image_urls : white ? [white] : []).filter(Boolean);
  if (!white) return raw;
  const others = raw.filter((u) => u !== white);
  return [...others, white];
}

/** 档案中除白底图外的样图 */
export function getArchiveExtraImages(p: {
  image_url?: string | null;
  image_urls?: string[] | null;
}): string[] {
  const white = getWhiteBgImage(p);
  return getProductImages(p).filter((u) => u !== white);
}

export type ProductSku = {
  id: string;
  /** 对应 clothing_styles.id / 旧称 product_id */
  product_id: string;
  color: string;
  size: string;
  /**
   * 可售库存（UI 字段）。
   * 真实库表 skus.current_stock 映射到此字段；不含返修隔离。
   */
  quantity: number;
  /** 返修隔离库存：已签收瑕疵品，不计入可售、不纳入销量统计 */
  repair_quantity?: number;
  sku_barcode: string | null;
  /** 软归档时间；非空表示已从默认库存列表隐藏 */
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** UI 聚合：款式 + SKU 列表（真实库为 clothing_styles + skus） */
export type ProductWithSkus = Product & {
  product_skus: ProductSku[];
};

export type InventoryRow = {
  sku_id: string;
  product_id: string;
  brand: string;
  style_no: string;
  product_name: string;
  category: string;
  retail_price: number;
  image_url: string | null;
  is_active: boolean;
  /** 对门店可见（款级） */
  store_visible: boolean;
  color: string;
  size: string;
  quantity: number;
  sku_barcode: string | null;
  product_barcode: string | null;
  /** 软归档时间；非空 = 已归档隐藏 */
  deleted_at?: string | null;
};

export type StockMovementRow = {
  id: string;
  created_at: string;
  movement_type: "inbound" | "shipment" | "adjust";
  quantity_delta: number;
  quantity_after: number;
  ref_no: string | null;
  remark: string | null;
  shop_id: string | null;
  shop_name: string | null;
  shop_code: string | null;
  operator_id: string | null;
  operator_name: string | null;
  sku_id: string;
  color: string;
  size: string;
  style_no: string;
  brand: string;
  product_name: string;
  category: string;
};

export type InboundOrder = {
  id: string;
  order_no: string;
  remark: string | null;
  status: "draft" | "submitted";
  created_by: string | null;
  submitted_at: string | null;
  created_at: string;
};

export type ShipmentOrder = {
  id: string;
  order_no: string;
  shop_id: string;
  remark: string | null;
  status: "draft" | "submitted";
  created_by: string | null;
  submitted_at: string | null;
  created_at: string;
  shops?: Shop | null;
};

export type OrderItemInput = {
  product_sku_id: string;
  quantity: number;
  /** 展示用 */
  style_no?: string;
  color?: string;
  size?: string;
  available?: number;
};

/** 补货需求：跟单录入，仓拣完成后一键出库 */
export type ReplenishStatus = "open" | "shipped" | "cancelled";

export type ReplenishRequest = {
  id: string;
  request_no: string;
  shop_id: string;
  request_date: string;
  status: ReplenishStatus;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  shipped_at: string | null;
  shipment_order_id: string | null;
  shops?: Shop | null;
};

export type ReplenishRequestItem = {
  id: string;
  request_id: string;
  product_sku_id: string;
  style_no: string;
  color: string;
  size: string;
  quantity: number;
  /** 款式图（展示用，来自商品档案） */
  image_url?: string | null;
};

export const REPLENISH_STATUS_LABEL: Record<ReplenishStatus, string> = {
  open: "待拣货",
  shipped: "已出库",
  cancelled: "已作废",
};

/** 返修常用瑕疵原因 */
export const DEFECT_REASON_OPTIONS = ["勾丝", "破洞", "污渍", "抽丝"] as const;
export type DefectReasonOption = (typeof DEFECT_REASON_OPTIONS)[number];

/**
 * 返修单状态：
 * 待签收 → 已签收待修 → 修复中 → 修复完成待发出 → 已发出；
 * 任一待修/修复中可 → 报废
 */
export type RepairStatus =
  | "pending_receive"
  | "received"
  | "repairing"
  | "repaired_pending_ship"
  | "shipped"
  | "scrapped";

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  pending_receive: "待签收",
  received: "已签收待修",
  repairing: "修复中",
  repaired_pending_ship: "修复完成待发出",
  shipped: "已发出",
  scrapped: "报废",
};

export type RepairOrderItem = {
  id: string;
  repair_id: string;
  product_sku_id: string;
  style_no: string;
  color: string;
  size: string;
  quantity: number;
  /** 勾选的常用瑕疵原因 */
  defect_reasons: string[];
  /** 自定义瑕疵备注 */
  defect_note: string | null;
  image_url?: string | null;
};

export type RepairOrder = {
  id: string;
  repair_no: string;
  shop_id: string;
  status: RepairStatus;
  /** portal = 店铺门户提交；manual = 后台录入 */
  source: "portal" | "manual";
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  received_at: string | null;
  repaired_at: string | null;
  shipped_at: string | null;
  scrapped_at: string | null;
  shops?: Shop | null;
  items?: RepairOrderItem[];
};

/** 是否可改档案/改价 */
export function canEditMaster(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

/** 是否可做出入库操作 */
export function canOperateStock(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "warehouse" || role === "merchandiser";
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "管理员",
  warehouse: "仓管",
  merchandiser: "跟单",
};
