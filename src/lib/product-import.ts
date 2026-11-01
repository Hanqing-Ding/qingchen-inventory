import ExcelJS from "exceljs";
import type { ProductImportLine } from "@/lib/mock/store";

const HEADER_ALIASES: Record<string, keyof Omit<ProductImportLine, "image_url"> | "ignore"> = {
  品牌: "brand",
  款号: "style_no",
  品名: "name",
  商品名称: "name",
  名称: "name",
  类别: "category",
  分类: "category",
  颜色: "color",
  尺码: "size",
  零售价: "retail_price",
  价格: "retail_price",
  成分: "composition",
  面料: "composition",
  条码: "barcode",
  初始库存: "quantity",
  库存: "quantity",
  图片: "ignore",
  图: "ignore",
  款式图: "ignore",
};

function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .replace(/\ufeff/g, "")
    .trim();
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof v.result === "string" || typeof v.result === "number") return String(v.result).trim();
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("").trim();
  }
  return String(value).trim();
}

function extensionToMime(ext?: string): string {
  const e = (ext || "").toLowerCase().replace(/^\./, "");
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  return "image/png";
}

function bufferToDataUrl(buffer: ExcelJS.Buffer | ArrayBuffer | Uint8Array, mime: string): string {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer as ArrayLike<number>);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

/** 解析商品导入 Excel（含嵌入图片，按所在行绑定到该行款号） */
export async function parseProductImportExcel(
  data: ArrayBuffer | Buffer,
): Promise<{ lines: ProductImportLine[]; warnings: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel 中没有工作表");

  const warnings: string[] = [];
  const headerRow = sheet.getRow(1);
  const colMap = new Map<number, keyof Omit<ProductImportLine, "image_url">>();

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = HEADER_ALIASES[normalizeHeader(cell.value)];
    if (key && key !== "ignore") colMap.set(colNumber, key);
  });

  if (![...colMap.values()].includes("style_no")) {
    throw new Error("缺少「款号」列，请使用导入模板");
  }
  if (![...colMap.values()].includes("color")) {
    throw new Error("缺少「颜色」列，请使用导入模板");
  }

  // 行号（1-based Excel 行）→ 图片 data URL（同一行多图取第一张）
  const imagesByRow = new Map<number, string>();
  try {
    const images = sheet.getImages();
    for (const img of images) {
      const rowIndex = Math.floor(img.range.tl.nativeRow ?? img.range.tl.row) + 1;
      if (imagesByRow.has(rowIndex)) continue;
      const media = workbook.getImage(+img.imageId);
      if (!media?.buffer) continue;
      const mime = extensionToMime(media.extension);
      imagesByRow.set(rowIndex, bufferToDataUrl(media.buffer, mime));
    }
  } catch {
    warnings.push("部分嵌入图片未能读取，已跳过图片");
  }

  const lines: ProductImportLine[] = [];
  const lastRow = sheet.actualRowCount || sheet.rowCount || 1;

  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const draft: Partial<ProductImportLine> & { style_no?: string; color?: string } = {};
    let hasAny = false;

    for (const [col, field] of colMap) {
      const raw = cellText(row.getCell(col).value);
      if (!raw) continue;
      hasAny = true;
      if (field === "retail_price") {
        draft.retail_price = Number(raw.replace(/[^\d.-]/g, ""));
      } else if (field === "quantity") {
        const n = Number(raw);
        draft.quantity = Number.isInteger(n) ? n : Math.floor(n);
      } else {
        (draft as Record<string, string>)[field] = raw;
      }
    }

    const img = imagesByRow.get(r);
    if (img) {
      draft.image_url = img;
      hasAny = true;
    }

    if (!hasAny) continue;
    if (!draft.style_no?.trim()) {
      warnings.push(`第 ${r} 行：缺少款号，已跳过`);
      continue;
    }
    if (!draft.color?.trim()) {
      warnings.push(`第 ${r} 行（${draft.style_no}）：缺少颜色，已跳过`);
      continue;
    }

    lines.push({
      brand: draft.brand?.trim() || "青陈",
      style_no: draft.style_no.trim(),
      name: draft.name?.trim() || draft.style_no.trim(),
      category: draft.category?.trim() || "未分类",
      color: draft.color.trim(),
      size: draft.size?.trim() || "均码",
      retail_price:
        draft.retail_price != null && Number.isFinite(draft.retail_price)
          ? draft.retail_price
          : 0,
      composition: draft.composition?.trim() || null,
      barcode: draft.barcode?.trim() || null,
      quantity: draft.quantity,
      image_url: draft.image_url ?? null,
    });
  }

  return { lines, warnings };
}

/** 生成可下载的导入模板（含表头说明行） */
export async function buildProductImportTemplate(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("商品导入");
  sheet.columns = [
    { header: "图片", key: "image", width: 14 },
    { header: "品牌", key: "brand", width: 12 },
    { header: "款号", key: "style_no", width: 14 },
    { header: "品名", key: "name", width: 20 },
    { header: "类别", key: "category", width: 10 },
    { header: "颜色", key: "color", width: 10 },
    { header: "尺码", key: "size", width: 8 },
    { header: "零售价", key: "retail_price", width: 10 },
    { header: "成分", key: "composition", width: 18 },
    { header: "条码", key: "barcode", width: 14 },
    { header: "初始库存", key: "quantity", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    brand: "青陈",
    style_no: "QC-DEMO",
    name: "示例大衣",
    category: "外套",
    color: "黑色",
    size: "M",
    retail_price: 999,
    composition: "羊毛 80%",
    barcode: "",
    quantity: 10,
  });
  sheet.addRow({
    brand: "青陈",
    style_no: "QC-DEMO",
    name: "示例大衣",
    category: "外套",
    color: "黑色",
    size: "L",
    retail_price: 999,
    composition: "羊毛 80%",
    barcode: "",
    quantity: 8,
  });
  sheet.getCell("A3").note =
    "可将款式图插入「图片」列对应单元格（同一款号多行只需放一张图）。已存在的颜色/尺码不会覆盖库存。";

  const buf = await workbook.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
