"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import {
  SHOP_TYPE_LABEL,
  shopKindToType,
  shopTypeToKind,
  type Shop,
  type ShopType,
} from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

type Props = {
  shop?: Shop;
  /** 可选父级（独立店铺） */
  parentOptions?: { id: string; name: string; code: string }[];
};

/** 合作店铺新增/编辑：独立店铺 / 下属门店 */
export function ShopForm({ shop, parentOptions = [] }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(shop?.code ?? "");
  const [name, setName] = useState(shop?.name ?? "");
  const [contactName, setContactName] = useState(shop?.contact_name ?? "");
  const [phone, setPhone] = useState(shop?.phone ?? "");
  const [address, setAddress] = useState(shop?.address ?? "");
  const [remark, setRemark] = useState(shop?.remark ?? "");
  const [shopType, setShopType] = useState<ShopType>(
    shop?.shop_type ?? shopKindToType(shop?.shop_kind) ?? "独立店铺",
  );
  const [parentId, setParentId] = useState(shop?.parent_id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim() || !name.trim()) {
      setError("店铺编码与名称为必填");
      return;
    }
    if (shopType === "下属门店" && !parentId) {
      setError("下属门店必须绑定父级独立店铺");
      return;
    }

    setLoading(true);
    const payload = {
      code: code.trim(),
      name: name.trim(),
      contact_name: contactName.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      remark: remark.trim() || null,
      shop_type: shopType,
      shop_kind: shopTypeToKind(shopType),
      parent_id: shopType === "下属门店" ? parentId || null : null,
      is_active: true,
    };

    try {
      if (isMockPreview()) {
        await mockAction("saveShop", { shop: payload, id: shop?.id });
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const { saveShop } = await import("@/lib/db/shops");
        await saveShop(createClient(), payload, shop?.code);
      }
      router.push("/shops");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="店铺编码 *">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="如：SH-001"
            required
            disabled={!!shop}
          />
        </Field>
        <Field label="店铺名称 *">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="零售方名称"
            required
          />
        </Field>
        <Field label="主体类型">
          <Select
            value={shopType}
            onChange={(e) => {
              const t = e.target.value as ShopType;
              setShopType(t);
              if (t !== "下属门店") setParentId("");
            }}
          >
            {(Object.keys(SHOP_TYPE_LABEL) as ShopType[]).map((t) => (
              <option key={t} value={t}>
                {SHOP_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="父级独立店铺">
          <Select
            value={parentId}
            disabled={shopType !== "下属门店"}
            onChange={(e) => setParentId(e.target.value)}
            required={shopType === "下属门店"}
          >
            <option value="">
              {shopType === "下属门店" ? "请选择父店" : "（仅下属门店需要）"}
            </option>
            {parentOptions
              .filter((h) => h.id !== shop?.id && h.code !== shop?.code)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}（{h.code}）
                </option>
              ))}
          </Select>
        </Field>
        <Field label="对接人">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label="电话">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <Field label="收货地址">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        <p className="mt-1 text-xs text-muted">
          下属门店出库/打印发货单时，收货地址自动取父店地址；备注自动带【来源门店：本店名称】。
        </p>
      </Field>
      <Field label="备注">
        <Textarea
          rows={2}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="合作说明、发货注意等"
        />
      </Field>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "保存中…" : "保存店铺"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
