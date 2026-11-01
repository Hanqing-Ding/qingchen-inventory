import type {
  ExternalShareLink,
  InventoryRow,
  ProductWithSkus,
  RepairOrder,
  RepairOrderItem,
  ReplenishRequest,
  ReplenishRequestItem,
  Shop,
  ShipmentOrder,
  StockMovementRow,
} from "@/types/database";
import { getProductImages, isStoreVisible } from "@/types/database";

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/** 在线可访问的服装样图（Unsplash，一款多图演示） */
export const MOCK_IMAGES = {
  coat: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&h=1000&fit=crop",
  coat2: "https://images.unsplash.com/photo-1548126032-079a0fb0099d?w=800&h=1000&fit=crop",
  coat3: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&h=1000&fit=crop&q=60",
  dress: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=1000&fit=crop",
  dress2: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&h=1000&fit=crop",
  dress3: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&h=1000&fit=crop",
  shirt: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=1000&fit=crop",
  shirt2: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&h=1000&fit=crop",
  pants: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=1000&fit=crop",
  pants2: "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=800&h=1000&fit=crop",
  knit: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&h=1000&fit=crop",
  knit2: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=1000&fit=crop",
  jacket: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=1000&fit=crop",
  jacket2: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=1000&fit=crop&sat=-20",
};

/** cover=白底图（库存/表单）；extras=档案其他图；档案顺序为 extras + 白底图在最后 */
function withGallery(cover: string, extras: string[]) {
  const others = extras.filter((u) => u && u !== cover);
  return { image_url: cover, image_urls: [...others, cover] };
}

export type MockDb = {
  products: ProductWithSkus[];
  shops: Shop[];
  /** 拓新样册 / 拓客商品档案外链 */
  shareLinks: ExternalShareLink[];
  replenishRequests: (ReplenishRequest & { items: ReplenishRequestItem[] })[];
  shipments: (ShipmentOrder & {
    items: {
      product_sku_id: string;
      quantity: number;
      style_no: string;
      color: string;
      size: string;
      brand: string;
      product_name: string;
      image_url?: string | null;
    }[];
  })[];
  movements: StockMovementRow[];
  /** 返修单据（与入库/补货完全独立） */
  repairOrders: (RepairOrder & { items: RepairOrderItem[] })[];
  seq: {
    inbound: number;
    shipment: number;
    replenish: number;
    adjust: number;
    repair: number;
  };
};

export function createSeedDb(): MockDb {
  const products: ProductWithSkus[] = [
    {
      id: "p-001",
      brand: "青陈",
      style_no: "QC-2401",
      name: "羊毛双面呢大衣",
      ...withGallery(MOCK_IMAGES.coat, [MOCK_IMAGES.coat2, MOCK_IMAGES.coat3]),
      composition: "羊毛 80% 羊绒 20%",
      category: "外套",
      season: "秋冬",
      retail_price: 1899,
      barcode: null,
      is_active: true,
      store_visible: true,
      created_by: null,
      updated_by: null,
      created_at: now(),
      updated_at: now(),
      product_skus: [
        { id: "s-001a", product_id: "p-001", color: "驼色", size: "S", quantity: 12, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-001b", product_id: "p-001", color: "驼色", size: "M", quantity: 18, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-001c", product_id: "p-001", color: "黑色", size: "M", quantity: 9, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-001d", product_id: "p-001", color: "黑色", size: "L", quantity: 7, sku_barcode: null, created_at: now(), updated_at: now() },
      ],
    },
    {
      id: "p-002",
      brand: "青陈",
      style_no: "QC-2418",
      name: "真丝吊带连衣裙",
      ...withGallery(MOCK_IMAGES.dress, [MOCK_IMAGES.dress2, MOCK_IMAGES.dress3]),
      composition: "桑蚕丝 100%",
      category: "连衣裙",
      season: "春夏",
      retail_price: 1280,
      barcode: null,
      is_active: true,
      store_visible: true,
      created_by: null,
      updated_by: null,
      created_at: now(),
      updated_at: now(),
      product_skus: [
        { id: "s-002a", product_id: "p-002", color: "香槟金", size: "S", quantity: 6, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-002b", product_id: "p-002", color: "香槟金", size: "M", quantity: 10, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-002c", product_id: "p-002", color: "墨绿", size: "M", quantity: 5, sku_barcode: null, created_at: now(), updated_at: now() },
      ],
    },
    {
      id: "p-003",
      brand: "青陈",
      style_no: "QC-2503",
      name: "法式亚麻衬衫",
      ...withGallery(MOCK_IMAGES.shirt, [MOCK_IMAGES.shirt2]),
      composition: "亚麻 55% 棉 45%",
      category: "上衣",
      season: "春夏",
      retail_price: 560,
      barcode: null,
      is_active: true,
      store_visible: true,
      created_by: null,
      updated_by: null,
      created_at: now(),
      updated_at: now(),
      product_skus: [
        { id: "s-003a", product_id: "p-003", color: "白色", size: "均码", quantity: 24, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-003b", product_id: "p-003", color: "雾蓝", size: "均码", quantity: 16, sku_barcode: null, created_at: now(), updated_at: now() },
      ],
    },
    {
      id: "p-004",
      brand: "青陈",
      style_no: "QC-2510",
      name: "高腰直筒牛仔裤",
      ...withGallery(MOCK_IMAGES.pants, [MOCK_IMAGES.pants2]),
      composition: "棉 98% 氨纶 2%",
      category: "裤装",
      season: "春夏",
      retail_price: 690,
      barcode: null,
      is_active: true,
      store_visible: true,
      created_by: null,
      updated_by: null,
      created_at: now(),
      updated_at: now(),
      product_skus: [
        { id: "s-004a", product_id: "p-004", color: "浅蓝", size: "25", quantity: 8, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-004b", product_id: "p-004", color: "浅蓝", size: "26", quantity: 14, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-004c", product_id: "p-004", color: "深蓝", size: "27", quantity: 11, sku_barcode: null, created_at: now(), updated_at: now() },
      ],
    },
    {
      id: "p-005",
      brand: "青陈",
      style_no: "QC-2522",
      name: "羊绒圆领针织衫",
      ...withGallery(MOCK_IMAGES.knit, [MOCK_IMAGES.knit2]),
      composition: "羊绒 100%",
      category: "针织",
      season: "秋冬",
      retail_price: 980,
      barcode: null,
      is_active: true,
      store_visible: true,
      created_by: null,
      updated_by: null,
      created_at: now(),
      updated_at: now(),
      product_skus: [
        { id: "s-005a", product_id: "p-005", color: "燕麦色", size: "S", quantity: 10, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-005b", product_id: "p-005", color: "燕麦色", size: "M", quantity: 15, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-005c", product_id: "p-005", color: "焦糖", size: "M", quantity: 4, sku_barcode: null, created_at: now(), updated_at: now() },
      ],
    },
    {
      id: "p-006",
      brand: "陈叙",
      style_no: "QC-2530",
      name: "短款皮夹克",
      ...withGallery(MOCK_IMAGES.jacket, [MOCK_IMAGES.jacket2]),
      composition: "绵羊皮",
      category: "外套",
      season: "秋冬",
      retail_price: 2680,
      barcode: null,
      is_active: true,
      store_visible: false,
      created_by: null,
      updated_by: null,
      created_at: now(),
      updated_at: now(),
      product_skus: [
        { id: "s-006a", product_id: "p-006", color: "黑色", size: "S", quantity: 3, sku_barcode: null, created_at: now(), updated_at: now() },
        { id: "s-006b", product_id: "p-006", color: "黑色", size: "M", quantity: 5, sku_barcode: null, created_at: now(), updated_at: now() },
      ],
    },
  ];

  const shops: Shop[] = [
    {
      id: "shop-hq-001",
      code: "HQ-HD-01",
      name: "华东买手集合总部",
      contact_name: "赵敏",
      phone: "0571-87001100",
      address: "杭州市上城区解放路 88 号青陈仓储中心（总部收货）",
      remark: "买手集合总部：下属门店发货地址走总部",
      is_active: true,
      created_at: now(),
      parent_id: null,
      shop_kind: "hq",
      portal_token: "hq-demo-portal-a1b2c3",
      portal_enabled: true,
      catalog_sku_ids: [
        "s-001a", "s-001b", "s-001c", "s-001d",
        "s-002a", "s-002b", "s-002c",
        "s-003a", "s-003b",
        "s-004a", "s-004b", "s-004c",
        "s-005a", "s-005b", "s-005c",
      ],
      portal_access_logs: [
        { id: "pal-1", at: now(), path: "/store-portal", note: "总部门户打开" },
      ],
    },
    {
      id: "shop-001",
      code: "SH-HZ-01",
      name: "杭州武林银泰店",
      contact_name: "陈雨",
      phone: "0571-88886666",
      address: "杭州市下城区延安路258号银泰百货 3F",
      remark: "周配，周四截单",
      is_active: true,
      created_at: now(),
      parent_id: "shop-hq-001",
      shop_kind: "branch",
      portal_token: "hz-demo-portal-8f3a2c",
      portal_enabled: true,
      catalog_sku_ids: [
        "s-001a", "s-001b", "s-001c", "s-001d",
        "s-002a", "s-002b", "s-002c",
        "s-005a", "s-005b", "s-005c",
      ],
      portal_access_logs: [],
    },
    {
      id: "shop-002",
      code: "SH-SH-02",
      name: "上海静安嘉里店",
      contact_name: "林晓",
      phone: "021-62558888",
      address: "上海市静安区南京西路1515号 2F",
      remark: "VIP 店，优先补爆款",
      is_active: true,
      created_at: now(),
      parent_id: null,
      shop_kind: "independent",
      portal_token: "sh-demo-portal-1b9e4d",
      portal_enabled: true,
      catalog_sku_ids: [
        "s-002a", "s-002b", "s-002c",
        "s-003a", "s-003b",
        "s-004a", "s-004b", "s-004c",
        "s-006a", "s-006b",
      ],
      portal_access_logs: [],
    },
    {
      id: "shop-003",
      code: "SH-NJ-03",
      name: "南京德基广场店",
      contact_name: "周倩",
      phone: "025-84778800",
      address: "南京市玄武区中山路18号德基广场 4F",
      remark: null,
      is_active: true,
      created_at: now(),
      parent_id: null,
      shop_kind: "independent",
      portal_token: null,
      portal_enabled: false,
      catalog_sku_ids: ["s-003a", "s-003b", "s-006a", "s-006b"],
      portal_access_logs: [],
    },
    {
      id: "shop-004",
      code: "SH-SZ-04",
      name: "苏州美罗商城店",
      contact_name: "王蕾",
      phone: "0512-65228899",
      address: "苏州市姑苏区观前街245号",
      remark: "新店，库存底量略高",
      is_active: true,
      created_at: now(),
      parent_id: "shop-hq-001",
      shop_kind: "branch",
      portal_token: "sz-demo-portal-7c2e91",
      portal_enabled: true,
      catalog_sku_ids: [
        "s-001b", "s-001c",
        "s-004a", "s-004b", "s-004c",
        "s-005a", "s-005b",
      ],
      portal_access_logs: [],
    },
  ];

  const shareLinks: ExternalShareLink[] = [
    {
      id: "sl-look-001",
      type: "lookbook",
      token: "lookbook-demo-autumn",
      title: "秋冬系列",
      product_ids: ["p-001", "p-005", "p-002"],
      enabled: true,
      created_at: now(),
      watermark: "青陈时尚",
      access_logs: [],
    },
    {
      id: "sl-pros-001",
      type: "prospect_archive",
      token: "prospect-demo-coat",
      title: "大衣精选",
      product_ids: ["p-001", "p-006"],
      enabled: true,
      created_at: now(),
      watermark: "青陈时尚",
      access_logs: [],
    },
  ];

  const replenishRequests: MockDb["replenishRequests"] = [
    {
      id: "rq-001",
      request_no: "RQ202611010001",
      shop_id: "shop-001",
      request_date: today(),
      status: "open",
      remark: "周末大促补货",
      created_by: "00000000-0000-4000-8000-000000000001",
      created_at: now(),
      shipped_at: null,
      shipment_order_id: null,
      shops: shops[0],
      items: [
        { id: "rqi-1", request_id: "rq-001", product_sku_id: "s-001b", style_no: "QC-2401", color: "驼色", size: "M", quantity: 4, image_url: MOCK_IMAGES.coat },
        { id: "rqi-2", request_id: "rq-001", product_sku_id: "s-002b", style_no: "QC-2418", color: "香槟金", size: "M", quantity: 3, image_url: MOCK_IMAGES.dress },
        { id: "rqi-3", request_id: "rq-001", product_sku_id: "s-005b", style_no: "QC-2522", color: "燕麦色", size: "M", quantity: 5, image_url: MOCK_IMAGES.knit },
      ],
    },
    {
      id: "rq-002",
      request_no: "RQ202611010002",
      shop_id: "shop-002",
      request_date: today(),
      status: "open",
      remark: "日常补货",
      created_by: "00000000-0000-4000-8000-000000000001",
      created_at: now(),
      shipped_at: null,
      shipment_order_id: null,
      shops: shops[1],
      items: [
        { id: "rqi-4", request_id: "rq-002", product_sku_id: "s-003a", style_no: "QC-2503", color: "白色", size: "均码", quantity: 8, image_url: MOCK_IMAGES.shirt },
        { id: "rqi-5", request_id: "rq-002", product_sku_id: "s-004b", style_no: "QC-2510", color: "浅蓝", size: "26", quantity: 6, image_url: MOCK_IMAGES.pants },
      ],
    },
    {
      id: "rq-003",
      request_no: "RQ202610310001",
      shop_id: "shop-003",
      request_date: "2026-10-31",
      status: "shipped",
      remark: "已发出",
      created_by: "00000000-0000-4000-8000-000000000001",
      created_at: "2026-10-31T08:00:00.000Z",
      shipped_at: "2026-10-31T14:00:00.000Z",
      shipment_order_id: "sh-001",
      shops: shops[2],
      items: [
        { id: "rqi-6", request_id: "rq-003", product_sku_id: "s-006b", style_no: "QC-2530", color: "黑色", size: "M", quantity: 2, image_url: MOCK_IMAGES.jacket },
      ],
    },
  ];

  const shipments: MockDb["shipments"] = [
    {
      id: "sh-001",
      order_no: "SH202610310001",
      shop_id: "shop-003",
      remark: "由补货需求 RQ202610310001 生成",
      status: "submitted",
      created_by: "00000000-0000-4000-8000-000000000001",
      submitted_at: "2026-10-31T14:00:00.000Z",
      created_at: "2026-10-31T14:00:00.000Z",
      shops: shops[2],
      items: [
        {
          product_sku_id: "s-006b",
          quantity: 2,
          style_no: "QC-2530",
          color: "黑色",
          size: "M",
          brand: "青陈",
          product_name: "短款皮夹克",
          image_url: MOCK_IMAGES.jacket,
        },
      ],
    },
  ];

  const movements: StockMovementRow[] = [
    {
      id: "m-001",
      created_at: "2026-10-31T14:00:00.000Z",
      movement_type: "shipment",
      quantity_delta: -2,
      quantity_after: 5,
      ref_no: "SH202610310001",
      remark: null,
      shop_id: "shop-003",
      shop_name: "南京德基广场店",
      shop_code: "SH-NJ-03",
      operator_id: null,
      operator_name: "开发管理员",
      sku_id: "s-006b",
      color: "黑色",
      size: "M",
      style_no: "QC-2530",
      brand: "青陈",
      product_name: "短款皮夹克",
      category: "外套",
    },
    {
      id: "m-002",
      created_at: "2026-10-30T10:00:00.000Z",
      movement_type: "inbound",
      quantity_delta: 20,
      quantity_after: 24,
      ref_no: "IN202610300001",
      remark: "期初入库",
      shop_id: null,
      shop_name: null,
      shop_code: null,
      operator_id: null,
      operator_name: "开发管理员",
      sku_id: "s-003a",
      color: "白色",
      size: "均码",
      style_no: "QC-2503",
      brand: "青陈",
      product_name: "法式亚麻衬衫",
      category: "上衣",
    },
  ];

  // 演示：已签收待修的大衣在隔离库存中
  const skuCoatM = products[0]?.product_skus.find((s) => s.id === "s-001b");
  if (skuCoatM) skuCoatM.repair_quantity = 2;

  const repairOrders: MockDb["repairOrders"] = [
    {
      id: "rp-001",
      repair_no: "RP202611010001",
      shop_id: "shop-001",
      status: "pending_receive",
      source: "portal",
      remark: "店铺门户提交",
      created_by: null,
      created_at: now(),
      updated_at: now(),
      received_at: null,
      repaired_at: null,
      shipped_at: null,
      scrapped_at: null,
      shops: shops[0],
      items: [
        {
          id: "rpi-1",
          repair_id: "rp-001",
          product_sku_id: "s-002a",
          style_no: "QC-2418",
          color: "香槟金",
          size: "S",
          quantity: 1,
          defect_reasons: ["勾丝"],
          defect_note: "肩部轻微勾丝",
          image_url: MOCK_IMAGES.dress,
        },
      ],
    },
    {
      id: "rp-002",
      repair_no: "RP202610280001",
      shop_id: "shop-002",
      status: "received",
      source: "portal",
      remark: null,
      created_by: null,
      created_at: "2026-10-28T09:00:00.000Z",
      updated_at: "2026-10-29T11:00:00.000Z",
      received_at: "2026-10-29T11:00:00.000Z",
      repaired_at: null,
      shipped_at: null,
      scrapped_at: null,
      shops: shops[1],
      items: [
        {
          id: "rpi-2",
          repair_id: "rp-002",
          product_sku_id: "s-001b",
          style_no: "QC-2401",
          color: "驼色",
          size: "M",
          quantity: 2,
          defect_reasons: ["破洞", "污渍"],
          defect_note: "袖口破洞，下摆污渍",
          image_url: MOCK_IMAGES.coat,
        },
      ],
    },
    {
      id: "rp-003",
      repair_no: "RP202610200001",
      shop_id: "shop-004",
      status: "repairing",
      source: "manual",
      remark: "加急",
      created_by: "00000000-0000-4000-8000-000000000001",
      created_at: "2026-10-20T08:00:00.000Z",
      updated_at: "2026-10-22T10:00:00.000Z",
      received_at: "2026-10-21T09:00:00.000Z",
      repaired_at: null,
      shipped_at: null,
      scrapped_at: null,
      shops: shops[3],
      items: [
        {
          id: "rpi-3",
          repair_id: "rp-003",
          product_sku_id: "s-005a",
          style_no: "QC-2522",
          color: "燕麦色",
          size: "S",
          quantity: 1,
          defect_reasons: ["抽丝"],
          defect_note: null,
          image_url: MOCK_IMAGES.knit,
        },
      ],
    },
    {
      id: "rp-004",
      repair_no: "RP202610150001",
      shop_id: "shop-001",
      status: "repaired_pending_ship",
      source: "portal",
      remark: null,
      created_by: null,
      created_at: "2026-10-15T08:00:00.000Z",
      updated_at: "2026-10-25T16:00:00.000Z",
      received_at: "2026-10-16T10:00:00.000Z",
      repaired_at: "2026-10-25T16:00:00.000Z",
      shipped_at: null,
      scrapped_at: null,
      shops: shops[0],
      items: [
        {
          id: "rpi-4",
          repair_id: "rp-004",
          product_sku_id: "s-004a",
          style_no: "QC-2510",
          color: "浅蓝",
          size: "25",
          quantity: 1,
          defect_reasons: ["污渍"],
          defect_note: "裤脚污渍已洗净",
          image_url: MOCK_IMAGES.pants,
        },
      ],
    },
    {
      id: "rp-005",
      repair_no: "RP202610050001",
      shop_id: "shop-002",
      status: "shipped",
      source: "portal",
      remark: null,
      created_by: null,
      created_at: "2026-10-05T08:00:00.000Z",
      updated_at: "2026-10-12T14:00:00.000Z",
      received_at: "2026-10-06T09:00:00.000Z",
      repaired_at: "2026-10-11T15:00:00.000Z",
      shipped_at: "2026-10-12T14:00:00.000Z",
      scrapped_at: null,
      shops: shops[1],
      items: [
        {
          id: "rpi-5",
          repair_id: "rp-005",
          product_sku_id: "s-003b",
          style_no: "QC-2503",
          color: "雾蓝",
          size: "均码",
          quantity: 1,
          defect_reasons: ["勾丝"],
          defect_note: null,
          image_url: MOCK_IMAGES.shirt,
        },
      ],
    },
    {
      id: "rp-006",
      repair_no: "RP202610010001",
      shop_id: "shop-003",
      status: "scrapped",
      source: "manual",
      remark: "无法修复",
      created_by: "00000000-0000-4000-8000-000000000001",
      created_at: "2026-10-01T08:00:00.000Z",
      updated_at: "2026-10-08T11:00:00.000Z",
      received_at: "2026-10-02T10:00:00.000Z",
      repaired_at: null,
      shipped_at: null,
      scrapped_at: "2026-10-08T11:00:00.000Z",
      shops: shops[2],
      items: [
        {
          id: "rpi-6",
          repair_id: "rp-006",
          product_sku_id: "s-006a",
          style_no: "QC-2530",
          color: "黑色",
          size: "S",
          quantity: 1,
          defect_reasons: ["破洞"],
          defect_note: "大面积破损报废",
          image_url: MOCK_IMAGES.jacket,
        },
      ],
    },
  ];

  // 修复中的针织衫也在隔离库存
  const skuKnit = products.find((p) => p.id === "p-005")?.product_skus.find((s) => s.id === "s-005a");
  if (skuKnit) skuKnit.repair_quantity = (skuKnit.repair_quantity ?? 0) + 1;

  return {
    products,
    shops,
    shareLinks,
    replenishRequests,
    shipments,
    movements,
    repairOrders,
    seq: { inbound: 1, shipment: 2, replenish: 3, adjust: 0, repair: 6 },
  };
}

export function flattenInventory(products: ProductWithSkus[]): InventoryRow[] {
  const rows: InventoryRow[] = [];
  for (const p of products) {
    for (const s of p.product_skus) {
      rows.push({
        sku_id: s.id,
        product_id: p.id,
        brand: p.brand,
        style_no: p.style_no,
        product_name: p.name,
        category: p.category,
        retail_price: p.retail_price,
        image_url: p.image_url ?? getProductImages(p).at(-1) ?? null,
        is_active: p.is_active,
        store_visible: isStoreVisible(p),
        color: s.color,
        size: s.size,
        quantity: s.quantity,
        sku_barcode: s.sku_barcode,
        product_barcode: p.barcode,
        deleted_at: s.deleted_at ?? null,
      });
    }
  }
  return rows.sort((a, b) =>
    a.style_no === b.style_no
      ? a.color === b.color
        ? a.size.localeCompare(b.size)
        : a.color.localeCompare(b.color)
      : a.style_no.localeCompare(b.style_no),
  );
}
