"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";

type Props = {
  skuId: string;
  quantity: number;
  /** 仓管/跟单/管理员可改 */
  canEdit: boolean;
};

/** 库存总表「库存」栏：直接改数 / +/-，写入调整流水 */
export function InventoryQtyEditor({ skuId, quantity, canEdit }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(String(quantity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(String(quantity));
  }, [quantity]);

  async function commit(nextQty: number) {
    if (!canEdit || saving) return;
    if (!Number.isInteger(nextQty) || nextQty < 0) {
      setError("须为非负整数");
      setValue(String(quantity));
      return;
    }
    if (nextQty === quantity) {
      setValue(String(quantity));
      setError("");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (isMockPreview()) {
        await mockAction("adjustInventory", {
          sku_id: skuId,
          quantity: nextQty,
          remark: "库存总表手工调整",
        });
      } else {
        const supabase = createClient();
        const { adjustInventory } = await import("@/lib/db/stock");
        await adjustInventory(supabase, {
          sku_id: skuId,
          quantity: nextQty,
          remark: "库存总表手工调整",
        });
      }
      setValue(String(nextQty));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
      setValue(String(quantity));
    } finally {
      setSaving(false);
    }
  }

  async function bump(delta: number) {
    const current = Number(value);
    const base = Number.isInteger(current) ? current : quantity;
    await commit(base + delta);
  }

  if (!canEdit) {
    return <span className="tabular-nums">{quantity}</span>;
  }

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={saving || quantity <= 0}
          onClick={() => bump(-1)}
          className="h-7 w-7 border border-line text-sm hover:border-ink disabled:opacity-40"
          aria-label="减一"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          disabled={saving}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => {
            const n = Number(value);
            if (value === "" || !Number.isInteger(n)) {
              setValue(String(quantity));
              return;
            }
            void commit(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setValue(String(quantity));
              setError("");
              e.currentTarget.blur();
            }
          }}
          className="w-14 border border-line bg-surface px-1 py-1 text-right text-sm tabular-nums outline-none focus:border-ink disabled:opacity-50"
          aria-label="库存数量"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => bump(1)}
          className="h-7 w-7 border border-line text-sm hover:border-ink disabled:opacity-40"
          aria-label="加一"
        >
          +
        </button>
      </div>
      {error ? <span className="max-w-[10rem] text-right text-[10px] text-red-700">{error}</span> : null}
    </div>
  );
}
