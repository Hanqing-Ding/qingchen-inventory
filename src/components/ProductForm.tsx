"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import {
  PRODUCT_SEASON_OPTIONS,
  buildProductImages,
  getProductImages,
  getWhiteBgImage,
  normalizeProductSeason,
  type ProductSku,
  type ProductWithSkus,
} from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

type SkuDraft = {
  id?: string;
  color: string;
  size: string;
  quantity: number;
  sku_barcode?: string;
};

type Props = {
  mode: "create" | "edit";
  /** 编辑模式传入已有商品 */
  product?: ProductWithSkus;
  /** 是否允许改价与档案（管理员） */
  canEdit: boolean;
  /** 保存成功后跳转；库存页嵌入时传 /inventory */
  redirectTo?: string;
  /** 紧凑布局（库存页上半区） */
  compact?: boolean;
  /** 隐藏样图区（档案页由独立图库管理） */
  hideImageField?: boolean;
};

const emptySku = (): SkuDraft => ({ color: "", size: "", quantity: 0 });

function readFilesAsDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("读图失败"));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export function ProductForm({
  mode,
  product,
  canEdit,
  redirectTo,
  compact = false,
  hideImageField = false,
}: Props) {
  const router = useRouter();
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [styleNo, setStyleNo] = useState(product?.style_no ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [composition, setComposition] = useState(product?.composition ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [season, setSeason] = useState(normalizeProductSeason(product?.season));
  const [retailPrice, setRetailPrice] = useState(
    product?.retail_price != null ? String(product.retail_price) : "",
  );
  const initialImages = product ? getProductImages(product) : [];
  const [imageUrls, setImageUrls] = useState<string[]>(initialImages);
  const [whiteBgUrl, setWhiteBgUrl] = useState<string>(
    product ? getWhiteBgImage(product) ?? initialImages[initialImages.length - 1] ?? "" : "",
  );
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [skus, setSkus] = useState<SkuDraft[]>(
    product?.product_skus?.length
      ? product.product_skus.map((s: ProductSku) => ({
          id: s.id,
          color: s.color,
          size: s.size,
          quantity: s.quantity,
          sku_barcode: s.sku_barcode ?? "",
        }))
      : [emptySku()],
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const readOnly = !canEdit;
  const afterSave = redirectTo ?? (mode === "create" ? "/inventory" : `/products/${product?.id}`);

  const whitePreview = useMemo(() => whiteBgUrl || "", [whiteBgUrl]);

  async function onPickImages(list: FileList | null) {
    if (!list?.length || readOnly) return;
    try {
      const uploaded = await readFilesAsDataUrls(Array.from(list));
      setImageUrls((prev) => {
        const next = [...prev, ...uploaded];
        if (!whiteBgUrl && next.length) {
          setWhiteBgUrl(next[0]);
        }
        return next;
      });
    } catch (errVal: unknown) {
      setError(errVal instanceof Error ? errVal.message : "读图失败");
    }
  }

  function removeImageAt(index: number) {
    setImageUrls((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (removed && removed === whiteBgUrl) {
        setWhiteBgUrl(next[0] ?? "");
      }
      return next;
    });
  }

  function updateSku(index: number, patch: Partial<SkuDraft>) {
    setSkus((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSkuRow() {
    setSkus((prev) => [...prev, emptySku()]);
  }

  function removeSkuRow(index: number) {
    setSkus((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!canEdit) {
      setError("当前角色不可修改基础资料与价格");
      return;
    }

    if (!brand.trim() || !styleNo.trim() || !name.trim() || !category.trim()) {
      setError("品牌、款号、品名、类别为必填");
      return;
    }

    const price = Number(retailPrice);
    if (Number.isNaN(price) || price < 0) {
      setError("零售价必须为不小于 0 的数字");
      return;
    }

    const cleaned = skus
      .map((s) => ({
        ...s,
        color: s.color.trim(),
        size: s.size.trim(),
        quantity: Number(s.quantity) || 0,
      }))
      .filter((s) => s.color && s.size);

    if (cleaned.length === 0) {
      setError("至少填写一行颜色 + 尺码");
      return;
    }

    // 校验款号内颜色+尺码唯一
    const keys = new Set<string>();
    for (const s of cleaned) {
      const k = `${s.color}__${s.size}`;
      if (keys.has(k)) {
        setError(`颜色+尺码重复：${s.color} / ${s.size}`);
        return;
      }
      keys.add(k);
      if (s.quantity < 0) {
        setError("库存数量不能为负");
        return;
      }
    }

    setLoading(true);

    try {
      // Mock 预览：写入内存假数据
      if (isMockPreview()) {
        const productId = product?.id ?? `p-${Date.now()}`;
        const white = whiteBgUrl || imageUrls[0] || null;
        const others = imageUrls.filter((u) => u !== white);
        const built = buildProductImages(white, others);
        const payload: ProductWithSkus = {
          id: productId,
          brand: brand.trim(),
          style_no: styleNo.trim(),
          name: name.trim(),
          image_url: built.image_url,
          image_urls: built.image_urls,
          composition: composition.trim() || null,
          category: category.trim(),
          season: normalizeProductSeason(season),
          retail_price: price,
          barcode: barcode.trim() || null,
          is_active: true,
          created_by: null,
          updated_by: null,
          created_at: product?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
          product_skus: cleaned.map((s) => ({
            id: s.id ?? `sku-${Math.random().toString(36).slice(2, 8)}`,
            product_id: productId,
            color: s.color,
            size: s.size,
            quantity: mode === "create" ? s.quantity : (s.id ? (product?.product_skus.find((x) => x.id === s.id)?.quantity ?? 0) : 0),
            sku_barcode: s.sku_barcode?.trim() || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        };
        await mockAction("saveProduct", { product: payload, isNew: mode === "create" });
        if (mode === "create") {
          setBrand("");
          setStyleNo("");
          setName("");
          setComposition("");
          setCategory("");
          setSeason("春夏");
          setRetailPrice("");
          setBarcode("");
          setImageUrls([]);
          setWhiteBgUrl("");
          setSkus([emptySku()]);
        }
        router.push(afterSave);
        router.refresh();
        return;
      }

      const supabase = createClient();
      let productId = product?.id;
      const finalImageUrl = whiteBgUrl || imageUrls[0] || null;

      // 四表：clothing_styles + skus；品牌→supplier，白底图→cover_img，备注→remark
      if (mode === "create") {
        const { data, error: insertError } = await supabase
          .from("clothing_styles")
          .insert({
            supplier: brand.trim(),
            style_no: styleNo.trim(),
            name: name.trim(),
            remark: composition.trim() || null,
            category: category.trim(),
            cover_img: finalImageUrl,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        productId = data.id;
      } else {
        const { error: updateError } = await supabase
          .from("clothing_styles")
          .update({
            supplier: brand.trim(),
            style_no: styleNo.trim(),
            name: name.trim(),
            remark: composition.trim() || null,
            category: category.trim(),
            cover_img: finalImageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product!.id);

        if (updateError) throw updateError;
      }

      if (mode === "create") {
        const { error: skuError } = await supabase.from("skus").insert(
          cleaned.map((s) => ({
            style_id: productId,
            color: s.color,
            size: s.size,
            current_stock: s.quantity,
            sell_price: price,
          })),
        );
        if (skuError) throw skuError;
      } else {
        for (const s of cleaned) {
          if (s.id) {
            const { error: skuUp } = await supabase
              .from("skus")
              .update({
                color: s.color,
                size: s.size,
                sell_price: price,
              })
              .eq("id", s.id);
            if (skuUp) throw skuUp;
          } else {
            const { error: skuIns } = await supabase.from("skus").insert({
              style_id: productId,
              color: s.color,
              size: s.size,
              current_stock: 0,
              sell_price: price,
            });
            if (skuIns) throw skuIns;
          }
        }
      }

      router.push(afterSave);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "保存失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-4" : "space-y-8"}>
      {readOnly ? (
        <Alert tone="info">当前为仓管/跟单角色，仅可查看档案，不可修改基础资料与价格。</Alert>
      ) : null}

      <div className={`grid gap-4 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <Field label="品牌 *">
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} disabled={readOnly} required />
        </Field>
        <Field label="款号 *">
          <Input value={styleNo} onChange={(e) => setStyleNo(e.target.value)} disabled={readOnly} required />
        </Field>
        <Field label="品名 *">
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} required />
        </Field>
        <Field label="品类 *">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} disabled={readOnly} required />
        </Field>
        <Field label="季节">
          <Select
            value={season}
            onChange={(e) => setSeason(normalizeProductSeason(e.target.value))}
            disabled={readOnly}
          >
            {PRODUCT_SEASON_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="零售价 *">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            disabled={readOnly}
            required
          />
        </Field>
        <Field label="条码（扫码扩展预留）">
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={readOnly} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="成分">
            <Textarea
              rows={2}
              value={composition}
              onChange={(e) => setComposition(e.target.value)}
              disabled={readOnly}
            />
          </Field>
        </div>
      </div>

      {!hideImageField ? (
        <div className="space-y-3">
          <div className={`grid gap-4 ${compact ? "sm:grid-cols-[120px_1fr]" : "sm:grid-cols-[160px_1fr]"}`}>
            <div className="aspect-[3/4] border border-line bg-background">
              {whitePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={whitePreview} alt="白底图" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">白底图预览</div>
              )}
            </div>
            <Field label="商品图片（可多选）">
              <Input
                type="file"
                accept="image/*"
                multiple
                disabled={readOnly}
                onChange={(e) => {
                  void onPickImages(e.target.files);
                  e.target.value = "";
                }}
              />
              <p className="mt-2 text-xs text-muted">
                可上传多张。请指定一张「白底图」——用于库存总表与各类单据缩略图；其余图显示在商品档案，白底图固定排在档案最后一张。
              </p>
            </Field>
          </div>
          {imageUrls.length ? (
            <div className="flex flex-wrap gap-3">
              {imageUrls.map((url, i) => {
                const isWhite = url === whiteBgUrl;
                return (
                  <div key={`${i}-${url.slice(0, 24)}`} className="relative w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className={`aspect-[3/4] w-full object-cover border ${
                        isWhite ? "border-ink" : "border-line"
                      }`}
                    />
                    <div className="mt-1 space-y-1">
                      {!readOnly ? (
                        <button
                          type="button"
                          className={`w-full text-[10px] ${
                            isWhite ? "bg-ink text-white" : "border border-line text-muted"
                          }`}
                          onClick={() => setWhiteBgUrl(url)}
                        >
                          {isWhite ? "白底图" : "设为白底"}
                        </button>
                      ) : (
                        <span className="block text-center text-[10px] text-muted">
                          {isWhite ? "白底图" : `图${i + 1}`}
                        </span>
                      )}
                      {!readOnly ? (
                        <button
                          type="button"
                          className="w-full text-[10px] text-red-700"
                          onClick={() => removeImageAt(i)}
                        >
                          移除
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.14em] text-muted">
            颜色 / 尺码 / 库存（唯一单元）
          </h2>
          {!readOnly ? (
            <Button type="button" variant="secondary" onClick={addSkuRow}>
              添加一行
            </Button>
          ) : null}
        </div>
        <div className="space-y-2">
          {skus.map((s, index) => (
            <div key={s.id ?? index} className="grid gap-2 sm:grid-cols-5">
              <Input
                placeholder="颜色 *"
                value={s.color}
                disabled={readOnly}
                onChange={(e) => updateSku(index, { color: e.target.value })}
              />
              <Input
                placeholder="尺码 *"
                value={s.size}
                disabled={readOnly}
                onChange={(e) => updateSku(index, { size: e.target.value })}
              />
              <Input
                type="number"
                min={0}
                placeholder="库存"
                value={s.quantity}
                disabled={readOnly || mode === "edit"}
                title={mode === "edit" ? "编辑档案不改库存，请走入库/发货" : undefined}
                onChange={(e) => updateSku(index, { quantity: Number(e.target.value) })}
              />
              <Input
                placeholder="SKU条码（预留）"
                value={s.sku_barcode ?? ""}
                disabled={readOnly}
                onChange={(e) => updateSku(index, { sku_barcode: e.target.value })}
              />
              {!readOnly ? (
                <Button type="button" variant="ghost" onClick={() => removeSkuRow(index)}>
                  移除
                </Button>
              ) : (
                <div />
              )}
            </div>
          ))}
        </div>
        {mode === "create" ? (
          <p className="mt-2 text-xs text-muted">新建时可填初始库存；之后增减请用入库/发货单。</p>
        ) : (
          <p className="mt-2 text-xs text-muted">编辑时新增颜色尺码初始库存为 0；库存变更请走单据。</p>
        )}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {!readOnly ? (
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "保存中…" : mode === "create" ? "新增并入库档" : "保存档案"}
          </Button>
          {!compact ? (
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              取消
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
