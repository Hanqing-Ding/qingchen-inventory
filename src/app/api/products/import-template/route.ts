import { NextResponse } from "next/server";
import { buildProductImportTemplate } from "@/lib/product-import";

export const runtime = "nodejs";

/** 下载商品 Excel 导入模板 */
export async function GET() {
  const buffer = await buildProductImportTemplate();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="product-import-template.xlsx"',
    },
  });
}
