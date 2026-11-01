"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import { Alert, Button } from "@/components/ui";

/** 商品档案页：对门店可见开关（与库存总表同步） */
export function StoreVisibleSwitch({
  productId,
  storeVisible,
  canEdit,
}: {
  productId: string;
  storeVisible: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(storeVisible);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function toggle() {
    if (!canEdit || !isMockPreview()) return;
    setBusy(true);
    setErr("");
    try {
      const next = !on;
      await mockAction("setStoreVisible", { productIds: [productId], visible: next });
      setOn(next);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border border-line bg-surface p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">对门店可见</div>
      <p className="text-xs text-muted">
        关闭后：店铺门户、拓新样册、拓客档案外链均不可见该款；后台与历史单据/看板不受影响。
      </p>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{on ? "已开启" : "已关闭"}</span>
        {canEdit ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void toggle()}>
            {busy ? "…" : on ? "关闭可见" : "开启可见"}
          </Button>
        ) : null}
      </div>
      {err ? <Alert>{err}</Alert> : null}
    </div>
  );
}
