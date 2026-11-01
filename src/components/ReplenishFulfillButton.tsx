"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import { Alert, Button } from "@/components/ui";

/** 仓拣完成后：一键生成出库单并扣库存 */
export function ReplenishFulfillButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fulfill() {
    if (!confirm("确认已拣货完成？将扣减库存并生成出库单。")) return;
    setError("");
    setLoading(true);
    try {
      if (isMockPreview()) {
        const ship = await mockAction<{ id: string }>("fulfillReplenish", { requestId });
        router.push(`/shipments/${ship.id}/print`);
      } else {
        throw new Error("四表模式下请直接使用「出库单」发货，补货需求表未接入");
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成出库单失败");
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    if (!confirm("确认作废该补货需求？")) return;
    setError("");
    setLoading(true);
    try {
      if (isMockPreview()) {
        await mockAction("cancelReplenish", { requestId });
      } else {
        throw new Error("四表模式下无补货需求表可作废");
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "作废失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={fulfill} disabled={loading}>
          {loading ? "处理中…" : "拣货完成，一键生成出库单"}
        </Button>
        <Button type="button" variant="ghost" onClick={cancel} disabled={loading}>
          作废需求
        </Button>
      </div>
      <p className="text-xs text-muted">
        生成出库单时会校验库存；不足则整单失败、不扣库存。成功后跳转打印页。
      </p>
    </div>
  );
}
