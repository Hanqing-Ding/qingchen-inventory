import { NextResponse } from "next/server";
import { isMockPreview } from "@/lib/mock/mode";
import { mockImportProducts } from "@/lib/mock/store";
import { parseProductImportExcel } from "@/lib/product-import";
import { getCurrentUser } from "@/lib/auth";
import { canEditMaster } from "@/types/database";

export const runtime = "nodejs";

/** Excel 批量导入商品档案（含嵌入图片）→ clothing_styles + skus */
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!canEditMaster(current?.profile?.role)) {
    return NextResponse.json({ error: "仅管理员可导入商品档案" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "仅支持 .xlsx 格式" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { lines, warnings } = await parseProductImportExcel(buffer);
    if (!lines.length) {
      return NextResponse.json(
        { error: "未解析到有效数据行", warnings },
        { status: 400 },
      );
    }

    if (isMockPreview()) {
      const result = mockImportProducts(lines);
      return NextResponse.json({ ...result, warnings });
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    let createdProducts = 0;
    let updatedProducts = 0;
    let createdSkus = 0;
    let skippedSkus = 0;
    const errors: string[] = [];

    const byStyle = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.style_no.toLowerCase();
      if (!byStyle.has(key)) byStyle.set(key, []);
      byStyle.get(key)!.push(line);
    }

    for (const [, group] of byStyle) {
      const head = group[0];
      const imageUrl = group.map((g) => g.image_url).find((u) => u?.trim()) ?? null;

      const { data: existing } = await supabase
        .from("clothing_styles")
        .select("id, skus(id, color, size)")
        .ilike("style_no", head.style_no)
        .maybeSingle();

      let productId: string;
      if (!existing) {
        const { data: created, error } = await supabase
          .from("clothing_styles")
          .insert({
            supplier: head.brand,
            style_no: head.style_no,
            name: head.name,
            category: head.category,
            remark: head.composition,
            cover_img: imageUrl,
          })
          .select("id")
          .single();
        if (error || !created) {
          errors.push(`${head.style_no}: ${error?.message ?? "创建失败"}`);
          continue;
        }
        productId = created.id;
        createdProducts += 1;
      } else {
        productId = existing.id;
        await supabase
          .from("clothing_styles")
          .update({
            supplier: head.brand,
            name: head.name,
            category: head.category,
            remark: head.composition,
            ...(imageUrl ? { cover_img: imageUrl } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", productId);
        updatedProducts += 1;
      }

      const existingSkus = Array.isArray(existing?.skus)
        ? (existing.skus as { id: string; color: string; size: string }[])
        : [];

      for (const line of group) {
        const size = line.size || "均码";
        if (existingSkus.some((s) => s.color === line.color && s.size === size)) {
          skippedSkus += 1;
          continue;
        }
        const qty =
          line.quantity != null && Number.isInteger(line.quantity) && line.quantity >= 0
            ? line.quantity
            : 0;
        const { error: skuErr } = await supabase.from("skus").insert({
          style_id: productId,
          color: line.color,
          size,
          current_stock: qty,
          sell_price: head.retail_price,
        });
        if (skuErr) {
          errors.push(`${line.style_no} ${line.color}/${size}: ${skuErr.message}`);
        } else {
          createdSkus += 1;
        }
      }
    }

    return NextResponse.json({
      createdProducts,
      updatedProducts,
      createdSkus,
      skippedSkus,
      errors,
      warnings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "导入失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
