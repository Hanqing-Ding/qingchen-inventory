/**
 * 出入库与库存调整。
 * 对齐线上已部署 RPC：
 * - quick_inbound(p_sku_id, p_quantity, p_batch_no, p_operator, p_remark)
 * - submit_stock_out(p_sku_id, p_quantity, p_order_no, p_customer, p_express_no, p_operator, p_remark)
 * - adjust_inventory(p_sku_id, p_new_stock, p_remark)
 * RPC 不可用时回退直写四表。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type QuickInboundResult = {
  order_no: string;
  style_no: string;
  color: string;
  size: string;
  quantity: number;
};

function nextDocNo(prefix: "IN" | "SH" | "ADJ") {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}${day}${seq}`;
}

async function currentOperator(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? data.user?.id ?? null;
}

function isMissingRpc(err: { code?: string } | null): boolean {
  return !err || err.code === "PGRST202";
}

async function resolveSku(
  supabase: SupabaseClient,
  styleNo: string,
  color: string,
  size: string,
): Promise<{ sku_id: string; style_no: string; current_stock: number }> {
  const { data: style, error: styleErr } = await supabase
    .from("clothing_styles")
    .select("id, style_no")
    .ilike("style_no", styleNo)
    .maybeSingle();
  if (styleErr) throw styleErr;
  if (!style) throw new Error(`未找到款号「${styleNo}」，请先在商品档案中建档`);

  // 优先未归档；若仅有归档 SKU（同色码唯一约束），自动恢复后再用
  type ResolvedSku = { id: string; current_stock: number | null };
  let sku: ResolvedSku | null = null;

  const { data: activeSku } = await supabase
    .from("skus")
    .select("id, current_stock")
    .eq("style_id", style.id)
    .eq("color", color)
    .eq("size", size)
    .is("deleted_at", null)
    .maybeSingle();
  sku = activeSku;

  if (!sku) {
    const { data: archived } = await supabase
      .from("skus")
      .select("id, current_stock")
      .eq("style_id", style.id)
      .eq("color", color)
      .eq("size", size)
      .not("deleted_at", "is", null)
      .maybeSingle();

    if (archived) {
      const { data: restored, error: restoreErr } = await supabase
        .from("skus")
        .update({ deleted_at: null })
        .eq("id", archived.id)
        .select("id, current_stock")
        .single();
      if (restoreErr) throw restoreErr;
      sku = restored;
    }
  }

  if (!sku) {
    const { data: created, error: skuInsErr } = await supabase
      .from("skus")
      .insert({
        style_id: style.id,
        color,
        size,
        current_stock: 0,
      })
      .select("id, current_stock")
      .single();
    if (skuInsErr) throw skuInsErr;
    sku = created;
  }

  return {
    sku_id: sku.id,
    style_no: style.style_no,
    current_stock: sku.current_stock ?? 0,
  };
}

/** 快捷入库：写 stock_in，并 current_stock += qty */
export async function quickInbound(
  supabase: SupabaseClient,
  input: {
    style_no: string;
    color: string;
    size: string | null;
    quantity: number;
    remark?: string | null;
  },
): Promise<QuickInboundResult> {
  const styleNo = input.style_no.trim();
  const color = input.color.trim();
  const size = input.size?.trim() || "均码";
  const quantity = input.quantity;
  const resolved = await resolveSku(supabase, styleNo, color, size);
  const batchNo = nextDocNo("IN");
  const operator = await currentOperator(supabase);

  const { error: rpcErr } = await supabase.rpc("quick_inbound", {
    p_sku_id: resolved.sku_id,
    p_quantity: quantity,
    p_batch_no: batchNo,
    p_operator: operator,
    p_remark: input.remark ?? null,
  });

  if (!rpcErr) {
    return {
      order_no: batchNo,
      style_no: resolved.style_no,
      color,
      size,
      quantity,
    };
  }
  if (!isMissingRpc(rpcErr)) throw rpcErr;

  // 回退：直写四表
  const { error: inErr } = await supabase.from("stock_in").insert({
    sku_id: resolved.sku_id,
    quantity,
    batch_no: batchNo,
    operator,
    remark: input.remark ?? null,
  });
  if (inErr) throw inErr;

  const next = resolved.current_stock + quantity;
  const { error: upErr } = await supabase
    .from("skus")
    .update({ current_stock: next })
    .eq("id", resolved.sku_id);
  if (upErr) throw upErr;

  return {
    order_no: batchNo,
    style_no: resolved.style_no,
    color,
    size,
    quantity,
  };
}

/** 手工出库：写 stock_out，并 current_stock -= qty（禁止负库存） */
export async function submitStockOut(
  supabase: SupabaseClient,
  input: {
    customer: string;
    /** shops.shop_code；RPC 不变，成功后回写 stock_out.shop_id */
    shop_id?: string | null;
    remark?: string | null;
    lines: { sku_id: string; quantity: number }[];
  },
): Promise<{ id: string; order_no: string }> {
  const orderNo = nextDocNo("SH");
  const operator = await currentOperator(supabase);
  let usedRpc = false;

  for (const line of input.lines) {
    const { error: rpcErr } = await supabase.rpc("submit_stock_out", {
      p_sku_id: line.sku_id,
      p_quantity: line.quantity,
      p_order_no: orderNo,
      p_customer: input.customer,
      p_express_no: null,
      p_operator: operator,
      p_remark: input.remark ?? null,
    });

    if (!rpcErr) {
      usedRpc = true;
      continue;
    }
    if (!isMissingRpc(rpcErr)) throw rpcErr;

    const { data: sku, error: skuErr } = await supabase
      .from("skus")
      .select("id, current_stock, color, size, clothing_styles(style_no)")
      .eq("id", line.sku_id)
      .maybeSingle();
    if (skuErr) throw skuErr;
    if (!sku) throw new Error(`SKU 不存在: ${line.sku_id}`);
    if ((sku.current_stock ?? 0) < line.quantity) {
      const styleRaw = sku.clothing_styles as
        | { style_no?: string }
        | { style_no?: string }[]
        | null;
      const style = Array.isArray(styleRaw) ? styleRaw[0] : styleRaw;
      throw new Error(
        `库存不足，禁止负库存：${style?.style_no ?? "?"} ${sku.color}/${sku.size}，需求 ${line.quantity}`,
      );
    }

    const { error: outErr } = await supabase.from("stock_out").insert({
      sku_id: line.sku_id,
      quantity: line.quantity,
      order_no: orderNo,
      customer: input.customer,
      shop_id: input.shop_id ?? null,
      operator,
      remark: input.remark ?? null,
    });
    if (outErr) throw outErr;

    const { error: upErr } = await supabase
      .from("skus")
      .update({ current_stock: (sku.current_stock ?? 0) - line.quantity })
      .eq("id", line.sku_id)
      .gte("current_stock", line.quantity);
    if (upErr) throw upErr;
  }

  // RPC 未带 shop_id：成功后回写，不改 RPC 签名
  if (usedRpc && input.shop_id) {
    const { error: linkErr } = await supabase
      .from("stock_out")
      .update({ shop_id: input.shop_id })
      .eq("order_no", orderNo);
    if (linkErr) throw linkErr;
  }

  return { id: orderNo, order_no: orderNo };
}

/** 库存总表调整：设为目标库存 */
export async function adjustInventory(
  supabase: SupabaseClient,
  input: { sku_id: string; quantity: number; remark?: string | null },
): Promise<void> {
  const { error: rpcErr } = await supabase.rpc("adjust_inventory", {
    p_sku_id: input.sku_id,
    p_new_stock: input.quantity,
    p_remark: input.remark ?? null,
  });
  if (!rpcErr) return;
  if (!isMissingRpc(rpcErr)) throw rpcErr;

  const { data: sku, error: skuErr } = await supabase
    .from("skus")
    .select("id, current_stock")
    .eq("id", input.sku_id)
    .maybeSingle();
  if (skuErr) throw skuErr;
  if (!sku) throw new Error("SKU 不存在");
  if (input.quantity < 0) throw new Error("库存须为非负整数");

  const before = sku.current_stock ?? 0;
  const delta = input.quantity - before;
  if (delta === 0) return;

  const operator = await currentOperator(supabase);
  if (delta > 0) {
    const { error } = await supabase.from("stock_in").insert({
      sku_id: input.sku_id,
      quantity: delta,
      batch_no: nextDocNo("ADJ"),
      operator,
      remark: input.remark ?? "库存总表手工调整",
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("stock_out").insert({
      sku_id: input.sku_id,
      quantity: Math.abs(delta),
      order_no: nextDocNo("ADJ"),
      customer: "库存调整",
      operator,
      remark: input.remark ?? "库存总表手工调整",
    });
    if (error) throw error;
  }

  const { error: upErr } = await supabase
    .from("skus")
    .update({ current_stock: input.quantity })
    .eq("id", input.sku_id);
  if (upErr) throw upErr;
}
