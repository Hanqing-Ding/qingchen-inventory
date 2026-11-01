import { createSeedDb, flattenInventory, type MockDb } from "@/lib/mock/seed";
import type {
  InventoryRow,
  PortalCatalogItem,
  ProductWithSkus,
  RepairOrder,
  RepairOrderItem,
  RepairStatus,
  ReplenishRequestItem,
  Shop,
  StockMovementRow,
} from "@/types/database";
import {
  buildProductImages,
  getProductImages,
  getWhiteBgImage,
  isStoreVisible,
  type ExternalShareLink,
  type ExternalShareType,
  type ShareAccessLog,
  type ShopKind,
} from "@/types/database";

const GLOBAL_KEY = "__qingchen_mock_db_v11__";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function docNo(prefix: string, seq: number) {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}${day}${String(seq).padStart(4, "0")}`;
}

/** 开发预览内存库（挂到 globalThis，避免 HMR 丢数据） */
export function getMockDb(): MockDb {
  const g = globalThis as unknown as Record<string, MockDb | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createSeedDb();
  }
  return g[GLOBAL_KEY]!;
}

export function resetMockDb() {
  const g = globalThis as unknown as Record<string, MockDb | undefined>;
  g[GLOBAL_KEY] = createSeedDb();
  return g[GLOBAL_KEY]!;
}

export function mockListInventory(filters?: {
  style_no?: string;
  brand?: string;
  category?: string;
  show_archived?: boolean;
}): InventoryRow[] {
  let rows = flattenInventory(getMockDb().products).filter((r) => r.is_active);
  if (filters?.show_archived) {
    rows = rows.filter((r) => !!r.deleted_at);
  } else {
    rows = rows.filter((r) => !r.deleted_at);
  }
  if (filters?.style_no) {
    const q = filters.style_no.toLowerCase();
    rows = rows.filter((r) => r.style_no.toLowerCase().includes(q));
  }
  if (filters?.brand) rows = rows.filter((r) => r.brand === filters.brand);
  if (filters?.category) rows = rows.filter((r) => r.category === filters.category);
  return rows;
}

export function mockListProducts(
  qOrFilters?:
    | string
    | {
        q?: string;
        brand?: string;
        category?: string;
        season?: string;
      },
): ProductWithSkus[] {
  const filters =
    typeof qOrFilters === "string" ? { q: qOrFilters } : qOrFilters ?? {};
  let list = getMockDb().products;
  if (filters.q?.trim()) {
    const s = filters.q.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.style_no.toLowerCase().includes(s) ||
        p.name.toLowerCase().includes(s),
    );
  }
  if (filters.brand?.trim()) {
    list = list.filter((p) => p.brand === filters.brand!.trim());
  }
  if (filters.category?.trim()) {
    list = list.filter((p) => p.category === filters.category!.trim());
  }
  if (filters.season?.trim()) {
    list = list.filter((p) => (p.season ?? "") === filters.season!.trim());
  }
  return list;
}

export function mockGetProduct(id: string) {
  return getMockDb().products.find((p) => p.id === id) ?? null;
}

/** 按款号取白底图（表单/单据缩略图）+ 档案全图 */
export function mockLookupStyleImage(styleNo: string) {
  const p = getMockDb().products.find(
    (x) => x.style_no.toLowerCase() === styleNo.trim().toLowerCase(),
  );
  const images = p ? getProductImages(p) : [];
  return {
    image_url: p ? getWhiteBgImage(p) : null,
    image_urls: images,
    style_no: p?.style_no ?? styleNo,
  };
}

/** 按 id 或款号取商品档案（门户只读也可用） */
export function mockGetProductByStyle(styleNo: string) {
  return (
    getMockDb().products.find(
      (p) => p.style_no.toLowerCase() === styleNo.trim().toLowerCase(),
    ) ?? null
  );
}

/** 更新商品样图列表（Mock）；白底图固定为最后一张并写入 image_url */
export function mockUpdateProductImages(
  productId: string,
  imageUrls: string[],
  whiteBgUrl?: string | null,
) {
  const p = getMockDb().products.find((x) => x.id === productId);
  if (!p) throw new Error("商品不存在");
  const urls = imageUrls.filter(Boolean);
  const white =
    (whiteBgUrl && urls.includes(whiteBgUrl) ? whiteBgUrl : null) ||
    (p.image_url && urls.includes(p.image_url) ? p.image_url : null) ||
    urls[urls.length - 1] ||
    null;
  const others = urls.filter((u) => u !== white);
  const built = buildProductImages(white, others);
  p.image_urls = built.image_urls;
  p.image_url = built.image_url;
  p.updated_at = new Date().toISOString();
  return p;
}

export function mockListShops(activeOnly = false) {
  const shops = getMockDb().shops;
  return activeOnly ? shops.filter((s) => s.is_active) : shops;
}

export function mockGetShop(id: string) {
  return getMockDb().shops.find((s) => s.id === id) ?? null;
}

export function mockSaveShop(input: Partial<Shop> & { code: string; name: string }, id?: string) {
  const db = getMockDb();
  if (id) {
    const idx = db.shops.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error("店铺不存在");
    db.shops[idx] = { ...db.shops[idx], ...input, id };
    return db.shops[idx];
  }
  if (db.shops.some((s) => s.code === input.code)) throw new Error("店铺编码已存在");
  const kind: ShopKind =
    input.shop_kind ??
    (input.parent_id ? "branch" : "independent");
  const shop: Shop = {
    id: uid("shop"),
    code: input.code,
    name: input.name,
    contact_name: input.contact_name ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    remark: input.remark ?? null,
    is_active: input.is_active ?? true,
    created_at: new Date().toISOString(),
    parent_id: input.parent_id ?? null,
    shop_kind: kind,
    portal_token: null,
    portal_enabled: false,
    catalog_sku_ids: [],
    portal_access_logs: [],
  };
  db.shops.unshift(shop);
  return shop;
}

/** 买手集合总部列表（父级候选） */
export function mockListHqShops() {
  return getMockDb().shops.filter((s) => s.shop_kind === "hq" || (!s.parent_id && s.shop_kind !== "branch"));
}

export function mockGetShopParent(shop: Shop): Shop | null {
  if (!shop.parent_id) return null;
  return mockGetShop(shop.parent_id);
}

/** 发货打印：收货地址优先父级总部；备注标注需求来源门店 */
export function mockResolveShipmentShipTo(shopId: string): {
  shipTo: Shop;
  sourceShop: Shop | null;
  sourceNote: string | null;
} {
  const shop = mockGetShop(shopId);
  if (!shop) throw new Error("店铺不存在");
  const parent = mockGetShopParent(shop);
  if (parent && shop.shop_kind === "branch") {
    return {
      shipTo: parent,
      sourceShop: shop,
      sourceNote: `【来源门店：${shop.name}】`,
    };
  }
  return { shipTo: shop, sourceShop: null, sourceNote: null };
}

function portalToken() {
  return `pt-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** 生成 / 刷新店铺门户分享密钥 */
export function mockGeneratePortalLink(shopId: string) {
  const shop = getMockDb().shops.find((s) => s.id === shopId);
  if (!shop) throw new Error("店铺不存在");
  shop.portal_token = portalToken();
  shop.portal_enabled = true;
  if (!shop.catalog_sku_ids?.length) {
    // 未绑定时默认挂上全部在售 SKU，便于演示
    shop.catalog_sku_ids = flattenInventory(getMockDb().products).map((r) => r.sku_id);
  }
  return shop;
}

/** 停用分享链接（保留 token，访问将提示已停用） */
export function mockDisablePortalLink(shopId: string) {
  const shop = getMockDb().shops.find((s) => s.id === shopId);
  if (!shop) throw new Error("店铺不存在");
  shop.portal_enabled = false;
  return shop;
}

export function mockGetShopByPortalToken(token: string) {
  return (
    getMockDb().shops.find((s) => s.portal_token === token) ?? null
  );
}

function pushAccessLog(
  logs: ShareAccessLog[] | undefined,
  path: string,
  note?: string,
): ShareAccessLog[] {
  const entry: ShareAccessLog = {
    id: uid("log"),
    at: new Date().toISOString(),
    path,
    note,
  };
  return [entry, ...(logs ?? [])].slice(0, 50);
}

/** 记录店铺门户访问 */
export function mockLogPortalAccess(token: string, path = "/store-portal") {
  const shop = mockGetShopByPortalToken(token);
  if (!shop || !shop.portal_enabled) return null;
  shop.portal_access_logs = pushAccessLog(shop.portal_access_logs, path, shop.name);
  return shop;
}

/** 门户只读目录：受「对门店可见」过滤；款号/图/颜色/尺码/库存，不含价格 */
export function mockGetPortalCatalog(token: string): {
  shop: Pick<Shop, "id" | "name" | "code" | "shop_kind" | "parent_id">;
  items: PortalCatalogItem[];
} {
  const shop = mockGetShopByPortalToken(token);
  if (!shop) throw new Error("链接无效或已失效");
  if (!shop.portal_enabled) throw new Error("该分享链接已停用，请联系青陈时尚重新开通");

  mockLogPortalAccess(token);

  const products = getMockDb().products;
  const visibleIds = new Set(
    products.filter((p) => isStoreVisible(p) && p.is_active).map((p) => p.id),
  );
  const inv = flattenInventory(products);
  const idSet = new Set(shop.catalog_sku_ids ?? []);
  const items: PortalCatalogItem[] = inv
    .filter(
      (r) =>
        idSet.has(r.sku_id) &&
        r.is_active &&
        visibleIds.has(r.product_id),
    )
    .map((r) => ({
      sku_id: r.sku_id,
      product_id: r.product_id,
      style_no: r.style_no,
      product_name: r.product_name,
      image_url: r.image_url,
      color: r.color,
      size: r.size,
      quantity: r.quantity,
    }));

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      code: shop.code,
      shop_kind: shop.shop_kind,
      parent_id: shop.parent_id ?? null,
    },
    items,
  };
}

/** Mock：批量软归档店铺 */
export function mockBatchArchiveShops(shopCodes: string[]) {
  const db = getMockDb();
  const now = new Date().toISOString();
  let archived = 0;
  for (const code of shopCodes) {
    const shop = db.shops.find((s) => s.code === code || s.id === code);
    if (!shop || shop.deleted_at) continue;
    shop.deleted_at = now;
    shop.is_active = false;
    archived += 1;
  }
  return { archived, blocked: [] as string[] };
}

/** Mock：批量恢复店铺 */
export function mockBatchRestoreShops(shopCodes: string[]) {
  const db = getMockDb();
  let restored = 0;
  for (const code of shopCodes) {
    const shop = db.shops.find((s) => s.code === code || s.id === code);
    if (!shop || !shop.deleted_at) continue;
    shop.deleted_at = null;
    shop.is_active = true;
    restored += 1;
  }
  return { restored };
}

/** 批量/单款设置对门店可见 */
export function mockSetStoreVisible(productIds: string[], visible: boolean) {
  const db = getMockDb();
  let n = 0;
  for (const id of productIds) {
    const p = db.products.find((x) => x.id === id);
    if (!p) continue;
    p.store_visible = visible;
    p.updated_at = new Date().toISOString();
    n += 1;
  }
  return { updated: n, store_visible: visible };
}

type MockSkuArchiveItem = {
  sku_id: string;
  style_no: string;
  color: string;
  size: string;
};

/** Mock：有流水归档，无流水物理删除 */
export function mockBatchDeleteOrArchiveSkus(items: MockSkuArchiveItem[]) {
  const db = getMockDb();
  const archivedItems: MockSkuArchiveItem[] = [];
  const deletedItems: MockSkuArchiveItem[] = [];
  const now = new Date().toISOString();

  for (const item of items) {
    const hasMovements = db.movements.some((m) => m.sku_id === item.sku_id);
    let removed = false;
    for (const p of db.products) {
      const idx = p.product_skus.findIndex((s) => s.id === item.sku_id);
      if (idx < 0) continue;
      if (hasMovements) {
        p.product_skus[idx] = {
          ...p.product_skus[idx],
          deleted_at: now,
        };
        archivedItems.push(item);
      } else {
        p.product_skus.splice(idx, 1);
        deletedItems.push(item);
      }
      p.updated_at = now;
      removed = true;
      break;
    }
    if (!removed) throw new Error(`SKU 不存在: ${item.sku_id}`);
  }

  return {
    archived: archivedItems.length,
    deleted: deletedItems.length,
    archivedItems,
    deletedItems,
  };
}

/** Mock：批量恢复归档 SKU */
export function mockBatchRestoreSkus(skuIds: string[]) {
  const db = getMockDb();
  let restored = 0;
  const now = new Date().toISOString();
  for (const id of skuIds) {
    for (const p of db.products) {
      const sku = p.product_skus.find((s) => s.id === id);
      if (!sku || !sku.deleted_at) continue;
      sku.deleted_at = null;
      p.updated_at = now;
      restored += 1;
      break;
    }
  }
  return { restored };
}

export function mockListShareLinks(type?: ExternalShareType) {
  let list = getMockDb().shareLinks;
  if (type) list = list.filter((s) => s.type === type);
  return list;
}

export function mockGetShareLinkByToken(token: string) {
  return getMockDb().shareLinks.find((s) => s.token === token) ?? null;
}

export function mockCreateShareLink(input: {
  type: ExternalShareType;
  title: string;
  product_ids: string[];
  watermark?: string | null;
}) {
  if (!input.product_ids.length) throw new Error("请至少勾选一款商品");
  const link: ExternalShareLink = {
    id: uid("sl"),
    type: input.type,
    token: `${input.type}-${Math.random().toString(36).slice(2, 10)}`,
    title: input.title.trim() || (input.type === "lookbook" ? "拓新样册" : "拓客商品档案"),
    product_ids: Array.from(new Set(input.product_ids)),
    enabled: true,
    created_at: new Date().toISOString(),
    watermark: input.watermark ?? "青陈时尚",
    access_logs: [],
  };
  getMockDb().shareLinks.unshift(link);
  return link;
}

export function mockDisableShareLink(id: string) {
  const link = getMockDb().shareLinks.find((s) => s.id === id);
  if (!link) throw new Error("链接不存在");
  link.enabled = false;
  return link;
}

export function mockEnableShareLink(id: string) {
  const link = getMockDb().shareLinks.find((s) => s.id === id);
  if (!link) throw new Error("链接不存在");
  link.enabled = true;
  return link;
}

/** 外链公开内容：仅 store_visible 商品；不含库存 */
export function mockGetPublicShareCatalog(token: string): {
  link: Pick<ExternalShareLink, "id" | "type" | "title" | "watermark" | "enabled">;
  products: {
    id: string;
    brand: string;
    style_no: string;
    name: string;
    category: string;
    season: string;
    image_url: string | null;
    image_urls: string[];
  }[];
} {
  const link = mockGetShareLinkByToken(token);
  if (!link) throw new Error("链接无效或已失效");
  if (!link.enabled) throw new Error("该分享链接已停用");

  link.access_logs = pushAccessLog(
    link.access_logs,
    link.type === "lookbook" ? "/lookbook" : "/prospect",
    link.title,
  );

  const idSet = new Set(link.product_ids);
  const products = getMockDb()
    .products.filter(
      (p) => idSet.has(p.id) && p.is_active && isStoreVisible(p),
    )
    .map((p) => ({
      id: p.id,
      brand: p.brand,
      style_no: p.style_no,
      name: p.name,
      category: p.category,
      season: String(p.season ?? ""),
      image_url: getWhiteBgImage(p),
      image_urls: getProductImages(p),
    }));

  return {
    link: {
      id: link.id,
      type: link.type,
      title: link.title,
      watermark: link.watermark ?? null,
      enabled: link.enabled,
    },
    products,
  };
}

/** 店铺门户提交补货需求 → 进入后台 /replenish */
export function mockPortalSubmitReplenish(
  token: string,
  lines: { sku_id: string; quantity: number }[],
  remark?: string | null,
) {
  const shop = mockGetShopByPortalToken(token);
  if (!shop) throw new Error("链接无效或已失效");
  if (!shop.portal_enabled) throw new Error("该分享链接已停用");
  if (!lines.length) throw new Error("请至少选择一件货品");

  const catalog = new Set(shop.catalog_sku_ids ?? []);
  const inv = flattenInventory(getMockDb().products);
  const draftLines: { style_no: string; color: string; size: string; quantity: number }[] = [];

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("补货数量须为正整数");
    }
    if (!catalog.has(line.sku_id)) {
      throw new Error("所选货品不在本店目录中");
    }
    const row = inv.find((r) => r.sku_id === line.sku_id);
    if (!row) throw new Error("货品不存在");
    draftLines.push({
      style_no: row.style_no,
      color: row.color,
      size: row.size,
      quantity: line.quantity,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  return mockCreateReplenish({
    shop_id: shop.id,
    request_date: today,
    remark: remark?.trim() || `店铺门户提交 · ${shop.name}`,
    lines: draftLines,
  });
}

function findOrCreateSku(styleNo: string, color: string, size: string) {
  const db = getMockDb();
  const product = db.products.find(
    (p) => p.style_no.toLowerCase() === styleNo.toLowerCase() && p.is_active,
  );
  if (!product) throw new Error(`未找到款号「${styleNo}」，请先在商品档案中建档`);
  const usedSize = size.trim() || "均码";
  let sku = product.product_skus.find((s) => s.color === color && s.size === usedSize);
  if (!sku) {
    sku = {
      id: uid("sku"),
      product_id: product.id,
      color,
      size: usedSize,
      quantity: 0,
      sku_barcode: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    product.product_skus.push(sku);
  }
  return { product, sku, usedSize };
}

export function mockQuickInbound(input: {
  style_no: string;
  color: string;
  size?: string | null;
  quantity: number;
}) {
  const db = getMockDb();
  const { product, sku, usedSize } = findOrCreateSku(
    input.style_no.trim(),
    input.color.trim(),
    input.size ?? "",
  );
  sku.quantity += input.quantity;
  sku.updated_at = new Date().toISOString();
  db.seq.inbound += 1;
  const orderNo = docNo("IN", db.seq.inbound);
  const movement: StockMovementRow = {
    id: uid("m"),
    created_at: new Date().toISOString(),
    movement_type: "inbound",
    quantity_delta: input.quantity,
    quantity_after: sku.quantity,
    ref_no: orderNo,
    remark: null,
    shop_id: null,
    shop_name: null,
    shop_code: null,
    operator_id: null,
    operator_name: "开发管理员",
    sku_id: sku.id,
    color: sku.color,
    size: usedSize,
    style_no: product.style_no,
    brand: product.brand,
    product_name: product.name,
    category: product.category,
  };
  db.movements.unshift(movement);
  return { order_no: orderNo, style_no: product.style_no, color: sku.color, size: usedSize, quantity: input.quantity };
}

export function mockSaveProduct(product: ProductWithSkus, isNew: boolean) {
  const db = getMockDb();
  const white = product.image_url ?? null;
  const built = buildProductImages(white, getProductImages(product).filter((u) => u !== white));
  const normalized: ProductWithSkus = {
    ...product,
    image_urls: built.image_urls,
    image_url: built.image_url,
    store_visible: product.store_visible !== false,
  };
  if (isNew) {
    if (db.products.some((p) => p.style_no === normalized.style_no)) {
      throw new Error("款号已存在");
    }
    db.products.unshift(normalized);
  } else {
    const idx = db.products.findIndex((p) => p.id === normalized.id);
    if (idx < 0) throw new Error("商品不存在");
    // 编辑档案时若未传图，保留原图库
    if (!product.image_urls?.length && !product.image_url) {
      const prev = db.products[idx];
      normalized.image_urls = getProductImages(prev);
      normalized.image_url = getWhiteBgImage(prev);
    }
    db.products[idx] = { ...db.products[idx], ...normalized, product_skus: normalized.product_skus };
  }
  return normalized;
}

export function mockListReplenish(status?: string) {
  let list = getMockDb().replenishRequests;
  if (status) list = list.filter((r) => r.status === status);
  return list.map((r) => ({
    ...r,
    shops: getMockDb().shops.find((s) => s.id === r.shop_id) ?? r.shops,
  }));
}

export function mockGetReplenish(id: string) {
  const r = getMockDb().replenishRequests.find((x) => x.id === id);
  if (!r) return null;
  return {
    ...r,
    shops: getMockDb().shops.find((s) => s.id === r.shop_id) ?? r.shops,
  };
}

export function mockCreateReplenish(input: {
  shop_id: string;
  request_date: string;
  remark?: string | null;
  lines: { style_no: string; color: string; size: string; quantity: number }[];
}) {
  const db = getMockDb();
  const shop = db.shops.find((s) => s.id === input.shop_id);
  if (!shop) throw new Error("店铺不存在");
  db.seq.replenish += 1;
  const id = uid("rq");
  const items: ReplenishRequestItem[] = input.lines.map((line) => {
    const { sku, usedSize, product } = findOrCreateSku(line.style_no, line.color, line.size);
    return {
      id: uid("rqi"),
      request_id: id,
      product_sku_id: sku.id,
      style_no: product.style_no,
      color: line.color,
      size: usedSize,
      quantity: line.quantity,
      image_url: product.image_url,
    };
  });
  const row = {
    id,
    request_no: docNo("RQ", db.seq.replenish),
    shop_id: input.shop_id,
    request_date: input.request_date,
    status: "open" as const,
    remark: input.remark ?? null,
    created_by: "00000000-0000-4000-8000-000000000001",
    created_at: new Date().toISOString(),
    shipped_at: null,
    shipment_order_id: null,
    shops: shop,
    items,
  };
  db.replenishRequests.unshift(row);
  return row;
}

export function mockFulfillReplenish(requestId: string) {
  const db = getMockDb();
  const req = db.replenishRequests.find((r) => r.id === requestId);
  if (!req) throw new Error("补货需求单不存在");
  if (req.status !== "open") throw new Error("需求单不可出库");
  if (!req.items.length) throw new Error("需求单无明细");

  for (const item of req.items) {
    const product = db.products.find((p) => p.product_skus.some((s) => s.id === item.product_sku_id));
    const sku = product?.product_skus.find((s) => s.id === item.product_sku_id);
    if (!sku || sku.quantity < item.quantity) {
      throw new Error(
        `库存不足，禁止负库存：${item.style_no} ${item.color}/${item.size}，需求 ${item.quantity}`,
      );
    }
  }

  const shop = db.shops.find((s) => s.id === req.shop_id);
  db.seq.shipment += 1;
  const shipId = uid("sh");
  const orderNo = docNo("SH", db.seq.shipment);
  const items = req.items.map((item) => {
    const product = db.products.find((p) => p.product_skus.some((s) => s.id === item.product_sku_id))!;
    const sku = product.product_skus.find((s) => s.id === item.product_sku_id)!;
    sku.quantity -= item.quantity;
    db.movements.unshift({
      id: uid("m"),
      created_at: new Date().toISOString(),
      movement_type: "shipment",
      quantity_delta: -item.quantity,
      quantity_after: sku.quantity,
      ref_no: orderNo,
      remark: `由补货需求 ${req.request_no} 生成`,
      shop_id: req.shop_id,
      shop_name: shop?.name ?? null,
      shop_code: shop?.code ?? null,
      operator_id: null,
      operator_name: "开发管理员",
      sku_id: sku.id,
      color: item.color,
      size: item.size,
      style_no: item.style_no,
      brand: product.brand,
      product_name: product.name,
      category: product.category,
    });
    return {
      product_sku_id: item.product_sku_id,
      quantity: item.quantity,
      style_no: item.style_no,
      color: item.color,
      size: item.size,
      brand: product.brand,
      product_name: product.name,
      image_url: product.image_url,
    };
  });

  const shipment = {
    id: shipId,
    order_no: orderNo,
    shop_id: req.shop_id,
    remark: `由补货需求 ${req.request_no} 生成`,
    status: "submitted" as const,
    created_by: "00000000-0000-4000-8000-000000000001",
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    shops: shop ?? null,
    items,
  };
  db.shipments.unshift(shipment);
  req.status = "shipped";
  req.shipped_at = shipment.submitted_at;
  req.shipment_order_id = shipId;
  return shipment;
}

export function mockCancelReplenish(requestId: string) {
  const req = getMockDb().replenishRequests.find((r) => r.id === requestId);
  if (!req || req.status !== "open") throw new Error("仅待拣货的需求单可作废");
  req.status = "cancelled";
  return req;
}

export function mockSearchSkus(styleNo: string) {
  const q = styleNo.trim().toLowerCase();
  const opts: {
    id: string;
    color: string;
    size: string;
    quantity: number;
    style_no: string;
  }[] = [];
  for (const p of getMockDb().products) {
    if (!p.is_active || !p.style_no.toLowerCase().includes(q)) continue;
    for (const s of p.product_skus) {
      opts.push({
        id: s.id,
        color: s.color,
        size: s.size,
        quantity: s.quantity,
        style_no: p.style_no,
      });
    }
  }
  return opts;
}

/** 手工发货单（Mock）：扣库存并生成可打印出库单 */
export function mockManualShipment(input: {
  shop_id: string;
  remark?: string | null;
  lines: { product_sku_id: string; quantity: number }[];
}) {
  const db = getMockDb();
  const shop = db.shops.find((s) => s.id === input.shop_id);
  if (!shop) throw new Error("店铺不存在");
  if (!input.lines.length) throw new Error("请至少添加一行明细");

  for (const line of input.lines) {
    const product = db.products.find((p) =>
      p.product_skus.some((s) => s.id === line.product_sku_id),
    );
    const sku = product?.product_skus.find((s) => s.id === line.product_sku_id);
    if (!sku || !product) throw new Error("SKU 不存在");
    if (sku.quantity < line.quantity) {
      throw new Error(
        `库存不足，禁止负库存：${product.style_no} ${sku.color}/${sku.size}`,
      );
    }
  }

  db.seq.shipment += 1;
  const shipId = uid("sh");
  const orderNo = docNo("SH", db.seq.shipment);
  const items = input.lines.map((line) => {
    const product = db.products.find((p) =>
      p.product_skus.some((s) => s.id === line.product_sku_id),
    )!;
    const sku = product.product_skus.find((s) => s.id === line.product_sku_id)!;
    sku.quantity -= line.quantity;
    db.movements.unshift({
      id: uid("m"),
      created_at: new Date().toISOString(),
      movement_type: "shipment",
      quantity_delta: -line.quantity,
      quantity_after: sku.quantity,
      ref_no: orderNo,
      remark: input.remark ?? null,
      shop_id: shop.id,
      shop_name: shop.name,
      shop_code: shop.code,
      operator_id: null,
      operator_name: "开发管理员",
      sku_id: sku.id,
      color: sku.color,
      size: sku.size,
      style_no: product.style_no,
      brand: product.brand,
      product_name: product.name,
      category: product.category,
    });
    return {
      product_sku_id: sku.id,
      quantity: line.quantity,
      style_no: product.style_no,
      color: sku.color,
      size: sku.size,
      brand: product.brand,
      product_name: product.name,
      image_url: product.image_url,
    };
  });

  const shipment = {
    id: shipId,
    order_no: orderNo,
    shop_id: shop.id,
    remark: input.remark ?? null,
    status: "submitted" as const,
    created_by: "00000000-0000-4000-8000-000000000001",
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    shops: shop,
    items,
  };
  db.shipments.unshift(shipment);
  return shipment;
}

export function mockListShipments() {
  return getMockDb().shipments.map((s) => ({
    ...s,
    shops: getMockDb().shops.find((x) => x.id === s.shop_id) ?? s.shops,
  }));
}

export function mockGetShipment(id: string) {
  const s = getMockDb().shipments.find((x) => x.id === id);
  if (!s) return null;
  return {
    ...s,
    shops: getMockDb().shops.find((x) => x.id === s.shop_id) ?? s.shops,
  };
}

export function mockListMovements(filters?: {
  ref_no?: string;
  style_no?: string;
  shop_id?: string;
  movement_type?: string;
}) {
  let rows = getMockDb().movements;
  if (filters?.ref_no) {
    const q = filters.ref_no.toLowerCase();
    rows = rows.filter((r) => r.ref_no?.toLowerCase().includes(q));
  }
  if (filters?.style_no) {
    const q = filters.style_no.toLowerCase();
    rows = rows.filter((r) => r.style_no.toLowerCase().includes(q));
  }
  if (filters?.shop_id) rows = rows.filter((r) => r.shop_id === filters.shop_id);
  if (filters?.movement_type) rows = rows.filter((r) => r.movement_type === filters.movement_type);
  return rows;
}

/**
 * 库存总表直接改数：设为目标库存，或按 delta 加减。
 * 禁止负库存；写入 movement_type = adjust 流水。
 */
export function mockAdjustInventory(input: {
  sku_id: string;
  /** 直接设为目标库存（优先） */
  quantity?: number;
  /** 相对增减 */
  delta?: number;
  remark?: string | null;
}) {
  const db = getMockDb();
  let product: ProductWithSkus | undefined;
  let sku: ProductWithSkus["product_skus"][number] | undefined;
  for (const p of db.products) {
    const found = p.product_skus.find((s) => s.id === input.sku_id);
    if (found) {
      product = p;
      sku = found;
      break;
    }
  }
  if (!product || !sku) throw new Error("SKU 不存在");

  const before = sku.quantity;
  let after: number;
  if (input.quantity != null) {
    if (!Number.isInteger(input.quantity) || input.quantity < 0) {
      throw new Error("库存须为非负整数");
    }
    after = input.quantity;
  } else if (input.delta != null) {
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new Error("增减须为非零整数");
    }
    after = before + input.delta;
  } else {
    throw new Error("请提供目标库存或增减量");
  }

  if (after < 0) throw new Error("库存不足，禁止负库存");
  if (after === before) {
    return {
      sku_id: sku.id,
      quantity_before: before,
      quantity_after: after,
      quantity_delta: 0,
      ref_no: null as string | null,
    };
  }

  sku.quantity = after;
  sku.updated_at = new Date().toISOString();
  db.seq.adjust += 1;
  const orderNo = docNo("ADJ", db.seq.adjust);
  const delta = after - before;
  db.movements.unshift({
    id: uid("m"),
    created_at: new Date().toISOString(),
    movement_type: "adjust",
    quantity_delta: delta,
    quantity_after: after,
    ref_no: orderNo,
    remark: input.remark?.trim() || "库存总表手工调整",
    shop_id: null,
    shop_name: null,
    shop_code: null,
    operator_id: null,
    operator_name: "开发管理员",
    sku_id: sku.id,
    color: sku.color,
    size: sku.size,
    style_no: product.style_no,
    brand: product.brand,
    product_name: product.name,
    category: product.category,
  });

  return {
    sku_id: sku.id,
    quantity_before: before,
    quantity_after: after,
    quantity_delta: delta,
    ref_no: orderNo,
  };
}

export type ProductImportLine = {
  brand: string;
  style_no: string;
  name: string;
  category: string;
  color: string;
  size: string;
  retail_price: number;
  composition?: string | null;
  barcode?: string | null;
  /** 仅新建 SKU 时写入；已存在 SKU 不覆盖库存 */
  quantity?: number;
  image_url?: string | null;
};

/** Excel 批量导入商品档案（按款号聚合 SKU；可含款式图 data URL） */
export function mockImportProducts(lines: ProductImportLine[]) {
  if (!lines.length) throw new Error("没有可导入的行");
  const db = getMockDb();
  let createdProducts = 0;
  let updatedProducts = 0;
  let createdSkus = 0;
  let skippedSkus = 0;
  const errors: string[] = [];

  // 按款号分组，保持首次出现顺序
  const groups = new Map<string, ProductImportLine[]>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const style = line.style_no?.trim();
    if (!style) {
      errors.push(`第 ${i + 1} 行：缺少款号`);
      continue;
    }
    if (!line.color?.trim()) {
      errors.push(`第 ${i + 1} 行（${style}）：缺少颜色`);
      continue;
    }
    const key = style.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ ...line, style_no: style });
  }

  for (const [, group] of groups) {
    const head = group[0];
    const styleNo = head.style_no.trim();
    let product = db.products.find(
      (p) => p.style_no.toLowerCase() === styleNo.toLowerCase(),
    );
    const imageFromRow = group.map((g) => g.image_url).find((u) => u?.trim()) ?? null;

    if (!product) {
      const brand = head.brand?.trim() || "青陈";
      const name = head.name?.trim() || styleNo;
      const category = head.category?.trim() || "未分类";
      product = {
        id: uid("p"),
        brand,
        style_no: styleNo,
        name,
        image_url: imageFromRow,
        image_urls: imageFromRow ? [imageFromRow] : [],
        composition: head.composition?.trim() || null,
        category,
        retail_price: Number.isFinite(head.retail_price) ? head.retail_price : 0,
        barcode: head.barcode?.trim() || null,
        is_active: true,
        created_by: null,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        product_skus: [],
      };
      db.products.unshift(product);
      createdProducts += 1;
    } else {
      if (head.brand?.trim()) product.brand = head.brand.trim();
      if (head.name?.trim()) product.name = head.name.trim();
      if (head.category?.trim()) product.category = head.category.trim();
      if (head.composition?.trim()) product.composition = head.composition.trim();
      if (head.barcode?.trim()) product.barcode = head.barcode.trim();
      if (Number.isFinite(head.retail_price) && head.retail_price >= 0) {
        product.retail_price = head.retail_price;
      }
      if (imageFromRow) {
        // Excel 图列视为白底图；其他档案图保留并排在白底前
        const prevWhite = product.image_url;
        const others = getProductImages(product).filter(
          (u) => u !== imageFromRow && u !== prevWhite,
        );
        const built = buildProductImages(imageFromRow, others);
        product.image_urls = built.image_urls;
        product.image_url = built.image_url;
      }
      product.updated_at = new Date().toISOString();
      updatedProducts += 1;
    }

    for (const line of group) {
      const color = line.color.trim();
      const size = (line.size?.trim() || "均码");
      const existing = product.product_skus.find(
        (s) => s.color === color && s.size === size,
      );
      if (existing) {
        skippedSkus += 1;
        continue;
      }
      const qty =
        line.quantity != null && Number.isInteger(line.quantity) && line.quantity >= 0
          ? line.quantity
          : 0;
      product.product_skus.push({
        id: uid("sku"),
        product_id: product.id,
        color,
        size,
        quantity: qty,
        sku_barcode: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      createdSkus += 1;
      if (qty > 0) {
        db.seq.adjust += 1;
        const orderNo = docNo("ADJ", db.seq.adjust);
        db.movements.unshift({
          id: uid("m"),
          created_at: new Date().toISOString(),
          movement_type: "adjust",
          quantity_delta: qty,
          quantity_after: qty,
          ref_no: orderNo,
          remark: "Excel 导入初始库存",
          shop_id: null,
          shop_name: null,
          shop_code: null,
          operator_id: null,
          operator_name: "开发管理员",
          sku_id: product.product_skus[product.product_skus.length - 1].id,
          color,
          size,
          style_no: product.style_no,
          brand: product.brand,
          product_name: product.name,
          category: product.category,
        });
      }
    }
  }

  return {
    createdProducts,
    updatedProducts,
    createdSkus,
    skippedSkus,
    errors,
  };
}

// ——— 返修单据（独立于入库 / 补货） ———

function findSkuById(skuId: string) {
  const db = getMockDb();
  for (const product of db.products) {
    const sku = product.product_skus.find((s) => s.id === skuId);
    if (sku) return { product, sku };
  }
  return null;
}

function quarantineOf(sku: ProductWithSkus["product_skus"][number]) {
  return sku.repair_quantity ?? 0;
}

export function mockListRepair(status?: string) {
  let list = getMockDb().repairOrders;
  if (status) list = list.filter((r) => r.status === status);
  return list.map((r) => ({
    ...r,
    shops: getMockDb().shops.find((s) => s.id === r.shop_id) ?? r.shops,
  }));
}

export function mockGetRepair(id: string) {
  const r = getMockDb().repairOrders.find((x) => x.id === id);
  if (!r) return null;
  return {
    ...r,
    shops: getMockDb().shops.find((s) => s.id === r.shop_id) ?? r.shops,
  };
}

export type RepairLineInput = {
  product_sku_id?: string;
  style_no: string;
  color: string;
  size: string;
  quantity: number;
  defect_reasons: string[];
  defect_note?: string | null;
};

function buildRepairItems(
  repairId: string,
  lines: RepairLineInput[],
): RepairOrderItem[] {
  return lines.map((line) => {
    let skuId = line.product_sku_id;
    let product = skuId ? findSkuById(skuId)?.product : undefined;
    if (!skuId) {
      const found = findOrCreateSku(line.style_no, line.color, line.size);
      skuId = found.sku.id;
      product = found.product;
    } else if (!product) {
      const found = findOrCreateSku(line.style_no, line.color, line.size);
      skuId = found.sku.id;
      product = found.product;
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("退回数量须为正整数");
    }
    if (!line.defect_reasons?.length && !line.defect_note?.trim()) {
      throw new Error("请选择瑕疵原因或填写备注");
    }
    return {
      id: uid("rpi"),
      repair_id: repairId,
      product_sku_id: skuId!,
      style_no: product!.style_no,
      color: line.color.trim(),
      size: (line.size?.trim() || "均码"),
      quantity: line.quantity,
      defect_reasons: line.defect_reasons ?? [],
      defect_note: line.defect_note?.trim() || null,
      image_url: product!.image_url,
    };
  });
}

/** 后台 / 门户创建返修单（待签收） */
export function mockCreateRepair(input: {
  shop_id: string;
  remark?: string | null;
  source?: "portal" | "manual";
  lines: RepairLineInput[];
}) {
  const db = getMockDb();
  const shop = db.shops.find((s) => s.id === input.shop_id);
  if (!shop) throw new Error("店铺不存在");
  if (!input.lines.length) throw new Error("请至少添加一行明细");

  db.seq.repair += 1;
  const id = uid("rp");
  const items = buildRepairItems(id, input.lines);
  const row: RepairOrder & { items: RepairOrderItem[] } = {
    id,
    repair_no: docNo("RP", db.seq.repair),
    shop_id: input.shop_id,
    status: "pending_receive",
    source: input.source ?? "manual",
    remark: input.remark?.trim() || null,
    created_by: "00000000-0000-4000-8000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    received_at: null,
    repaired_at: null,
    shipped_at: null,
    scrapped_at: null,
    shops: shop,
    items,
  };
  db.repairOrders.unshift(row);
  return row;
}

/** 店铺门户提交返修申请 → 进入后台返修列表 */
export function mockPortalSubmitRepair(
  token: string,
  lines: {
    sku_id: string;
    quantity: number;
    defect_reasons: string[];
    defect_note?: string | null;
  }[],
  remark?: string | null,
) {
  const shop = mockGetShopByPortalToken(token);
  if (!shop) throw new Error("链接无效或已失效");
  if (!shop.portal_enabled) throw new Error("该分享链接已停用");
  if (!lines.length) throw new Error("请至少选择一件货品");

  const catalog = new Set(shop.catalog_sku_ids ?? []);
  const draft: RepairLineInput[] = [];
  for (const line of lines) {
    if (!catalog.has(line.sku_id)) throw new Error("所选货品不在本店目录中");
    const found = findSkuById(line.sku_id);
    if (!found) throw new Error("货品不存在");
    draft.push({
      product_sku_id: line.sku_id,
      style_no: found.product.style_no,
      color: found.sku.color,
      size: found.sku.size,
      quantity: line.quantity,
      defect_reasons: line.defect_reasons,
      defect_note: line.defect_note,
    });
  }

  return mockCreateRepair({
    shop_id: shop.id,
    remark: remark?.trim() || `店铺门户返修 · ${shop.name}`,
    source: "portal",
    lines: draft,
  });
}

/**
 * 签收：瑕疵货进入【返修隔离库存】，不改可售 quantity，
 * 不写销量相关出库流水。
 */
export function mockRepairReceive(repairId: string) {
  const db = getMockDb();
  const order = db.repairOrders.find((r) => r.id === repairId);
  if (!order) throw new Error("返修单不存在");
  if (order.status !== "pending_receive") throw new Error("仅待签收单据可签收");

  for (const item of order.items) {
    const found = findSkuById(item.product_sku_id);
    if (!found) throw new Error(`SKU 不存在：${item.style_no}`);
    found.sku.repair_quantity = quarantineOf(found.sku) + item.quantity;
    found.sku.updated_at = new Date().toISOString();
  }

  order.status = "received";
  order.received_at = new Date().toISOString();
  order.updated_at = order.received_at;
  return order;
}

export function mockRepairStart(repairId: string) {
  const order = getMockDb().repairOrders.find((r) => r.id === repairId);
  if (!order) throw new Error("返修单不存在");
  if (order.status !== "received") throw new Error("仅「已签收待修」可开始修复");
  order.status = "repairing";
  order.updated_at = new Date().toISOString();
  return order;
}

/**
 * 修复完成：隔离库存转回可售库存；
 * 不记入销量统计（仅内部可用量变化，无 shipment 流水）。
 */
export function mockRepairComplete(repairId: string) {
  const db = getMockDb();
  const order = db.repairOrders.find((r) => r.id === repairId);
  if (!order) throw new Error("返修单不存在");
  if (order.status !== "repairing") throw new Error("仅「修复中」可标记修复完成");

  for (const item of order.items) {
    const found = findSkuById(item.product_sku_id);
    if (!found) throw new Error(`SKU 不存在：${item.style_no}`);
    const q = quarantineOf(found.sku);
    if (q < item.quantity) {
      throw new Error(`返修隔离库存不足：${item.style_no} ${item.color}/${item.size}`);
    }
    found.sku.repair_quantity = q - item.quantity;
    found.sku.quantity += item.quantity;
    found.sku.updated_at = new Date().toISOString();
  }

  order.status = "repaired_pending_ship";
  order.repaired_at = new Date().toISOString();
  order.updated_at = order.repaired_at;
  return order;
}

/**
 * 发出：从可售库存扣减并发回店铺；
 * 使用 remark 标记返修发出，看板销量统计排除此类流水。
 */
export function mockRepairShip(repairId: string) {
  const db = getMockDb();
  const order = db.repairOrders.find((r) => r.id === repairId);
  if (!order) throw new Error("返修单不存在");
  if (order.status !== "repaired_pending_ship") {
    throw new Error("仅「修复完成待发出」可发出");
  }

  const shop = db.shops.find((s) => s.id === order.shop_id);

  for (const item of order.items) {
    const found = findSkuById(item.product_sku_id);
    if (!found) throw new Error(`SKU 不存在：${item.style_no}`);
    if (found.sku.quantity < item.quantity) {
      throw new Error(
        `可售库存不足，无法发出：${item.style_no} ${item.color}/${item.size}`,
      );
    }
    found.sku.quantity -= item.quantity;
    found.sku.updated_at = new Date().toISOString();
    db.movements.unshift({
      id: uid("m"),
      created_at: new Date().toISOString(),
      movement_type: "shipment",
      quantity_delta: -item.quantity,
      quantity_after: found.sku.quantity,
      ref_no: order.repair_no,
      remark: "返修发货（不计入销量统计）",
      shop_id: order.shop_id,
      shop_name: shop?.name ?? null,
      shop_code: shop?.code ?? null,
      operator_id: null,
      operator_name: "开发管理员",
      sku_id: found.sku.id,
      color: item.color,
      size: item.size,
      style_no: item.style_no,
      brand: found.product.brand,
      product_name: found.product.name,
      category: found.product.category,
    });
  }

  order.status = "shipped";
  order.shipped_at = new Date().toISOString();
  order.updated_at = order.shipped_at;
  return order;
}

/**
 * 报废：核销隔离库存（若已修复完成则扣可售）；
 * 不进入销量统计。
 */
export function mockRepairScrap(repairId: string, remark?: string | null) {
  const db = getMockDb();
  const order = db.repairOrders.find((r) => r.id === repairId);
  if (!order) throw new Error("返修单不存在");
  const allowed: RepairStatus[] = ["received", "repairing", "repaired_pending_ship"];
  if (!allowed.includes(order.status)) {
    throw new Error("当前状态不可报废");
  }

  const fromSellable = order.status === "repaired_pending_ship";

  for (const item of order.items) {
    const found = findSkuById(item.product_sku_id);
    if (!found) throw new Error(`SKU 不存在：${item.style_no}`);
    if (fromSellable) {
      if (found.sku.quantity < item.quantity) {
        throw new Error(`可售库存不足，无法报废：${item.style_no}`);
      }
      found.sku.quantity -= item.quantity;
    } else {
      const q = quarantineOf(found.sku);
      if (q < item.quantity) {
        throw new Error(`返修隔离库存不足，无法报废：${item.style_no}`);
      }
      found.sku.repair_quantity = q - item.quantity;
    }
    found.sku.updated_at = new Date().toISOString();
    db.movements.unshift({
      id: uid("m"),
      created_at: new Date().toISOString(),
      movement_type: "adjust",
      quantity_delta: fromSellable ? -item.quantity : 0,
      quantity_after: found.sku.quantity,
      ref_no: order.repair_no,
      remark: `返修报废核销${remark?.trim() ? `：${remark.trim()}` : ""}（不计入销量）`,
      shop_id: order.shop_id,
      shop_name: order.shops?.name ?? null,
      shop_code: order.shops?.code ?? null,
      operator_id: null,
      operator_name: "开发管理员",
      sku_id: found.sku.id,
      color: item.color,
      size: item.size,
      style_no: item.style_no,
      brand: found.product.brand,
      product_name: found.product.name,
      category: found.product.category,
    });
  }

  if (remark?.trim()) {
    order.remark = [order.remark, remark.trim()].filter(Boolean).join("；");
  }
  order.status = "scrapped";
  order.scrapped_at = new Date().toISOString();
  order.updated_at = order.scrapped_at;
  return order;
}

/** 看板：当月返修统计（与正常出库爆款完全分离） */
export function mockRepairDashboardStats(month?: string) {
  const db = getMockDb();
  const ym =
    month ??
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

  const inMonth = db.repairOrders.filter((r) => r.created_at.slice(0, 7) === ym);
  let totalQty = 0;
  const reasonCount: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const order of inMonth) {
    byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
    for (const item of order.items) {
      totalQty += item.quantity;
      const reasons = item.defect_reasons.length
        ? item.defect_reasons
        : ["其他"];
      for (const reason of reasons) {
        reasonCount[reason] = (reasonCount[reason] ?? 0) + item.quantity;
      }
    }
  }

  return {
    month: ym,
    orderCount: inMonth.length,
    totalQty,
    reasonDistribution: Object.entries(reasonCount)
      .map(([reason, qty]) => ({ reason, qty }))
      .sort((a, b) => b.qty - a.qty),
    byStatus,
  };
}

/** 看板：当月正常出库爆款（排除返修发货流水） */
export function mockSalesHotStats(month?: string) {
  const db = getMockDb();
  const ym =
    month ??
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

  const map = new Map<
    string,
    { style_no: string; product_name: string; qty: number }
  >();

  for (const m of db.movements) {
    if (m.movement_type !== "shipment") continue;
    if (m.created_at.slice(0, 7) !== ym) continue;
    // 返修进出不纳入销量
    if (m.remark?.includes("返修")) continue;
    if (m.ref_no?.startsWith("RP")) continue;
    const key = m.style_no;
    const prev = map.get(key) ?? {
      style_no: m.style_no,
      product_name: m.product_name,
      qty: 0,
    };
    prev.qty += Math.abs(m.quantity_delta);
    map.set(key, prev);
  }

  return {
    month: ym,
    hotStyles: [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
  };
}

/** 返修隔离库存一览（不进入可售库存总表数量） */
export function mockListRepairQuarantine() {
  const rows: (InventoryRow & { repair_quantity: number })[] = [];
  for (const p of getMockDb().products) {
    for (const s of p.product_skus) {
      const rq = s.repair_quantity ?? 0;
      if (rq <= 0) continue;
      rows.push({
        sku_id: s.id,
        product_id: p.id,
        brand: p.brand,
        style_no: p.style_no,
        product_name: p.name,
        category: p.category,
        retail_price: p.retail_price,
        image_url: p.image_url,
        is_active: p.is_active,
        store_visible: isStoreVisible(p),
        color: s.color,
        size: s.size,
        quantity: s.quantity,
        repair_quantity: rq,
        sku_barcode: s.sku_barcode,
        product_barcode: p.barcode,
      });
    }
  }
  return rows;
}

