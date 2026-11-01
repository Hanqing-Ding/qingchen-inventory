"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mockAction } from "@/lib/mock/client";
import type { RepairStatus } from "@/types/database";
import { Alert, Button } from "@/components/ui";

type Props = {
  repairId: string;
  status: RepairStatus;
};

/** 返修单状态流转操作（Mock） */
export function RepairActions({ repairId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: string, redirectPrint = false) {
    setError("");
    setLoading(true);
    try {
      await mockAction(action, { repairId });
      if (redirectPrint) {
        router.push(`/repair/${repairId}/print`);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  async function scrap() {
    const note = window.prompt("报废原因（可选）", "") ?? "";
    setError("");
    setLoading(true);
    try {
      await mockAction("repairScrap", { repairId, remark: note || null });
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "报废失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {status === "pending_receive" ? (
          <Button type="button" disabled={loading} onClick={() => void run("repairReceive")}>
            签收进入隔离库存
          </Button>
        ) : null}
        {status === "received" ? (
          <Button type="button" disabled={loading} onClick={() => void run("repairStart")}>
            开始修复
          </Button>
        ) : null}
        {status === "repairing" ? (
          <Button type="button" disabled={loading} onClick={() => void run("repairComplete")}>
            修复完成（转回可售）
          </Button>
        ) : null}
        {status === "repaired_pending_ship" ? (
          <Button
            type="button"
            disabled={loading}
            onClick={() => void run("repairShip", true)}
          >
            发出并打印
          </Button>
        ) : null}
        {status === "shipped" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/repair/${repairId}/print`)}
          >
            查看发货单
          </Button>
        ) : null}
        {status === "received" ||
        status === "repairing" ||
        status === "repaired_pending_ship" ? (
          <Button type="button" variant="danger" disabled={loading} onClick={() => void scrap()}>
            标记报废
          </Button>
        ) : null}
      </div>
    </div>
  );
}
