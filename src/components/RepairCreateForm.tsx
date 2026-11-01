"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { mockAction } from "@/lib/mock/client";
import { DEFECT_REASON_OPTIONS } from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

type ShopOpt = { id: string; name: string; code: string };

type Line = {
  style_no: string;
  color: string;
  size: string;
  quantity: string;
  reasons: string[];
  defect_note: string;
};

const emptyLine = (): Line => ({
  style_no: "",
  color: "",
  size: "",
  quantity: "1",
  reasons: [],
  defect_note: "",
});

/** 后台手工录入返修单（与补货/入库表单独立） */
export function RepairCreateForm({ shops }: { shops: ShopOpt[] }) {
  const router = useRouter();
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const [remark, setRemark] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function toggleReason(i: number, reason: string) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const has = l.reasons.includes(reason);
        return {
          ...l,
          reasons: has ? l.reasons.filter((r) => r !== reason) : [...l.reasons, reason],
        };
      }),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!shopId) {
      setError("请选择店铺");
      return;
    }
    const payload = lines.map((l) => ({
      style_no: l.style_no.trim(),
      color: l.color.trim(),
      size: l.size.trim() || "均码",
      quantity: Number(l.quantity),
      defect_reasons: l.reasons,
      defect_note: l.defect_note.trim() || null,
    }));
    for (const l of payload) {
      if (!l.style_no || !l.color) {
        setError("请填写款号与颜色");
        return;
      }
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
        setError("退回数量须为正整数");
        return;
      }
      if (!l.defect_reasons.length && !l.defect_note) {
        setError("请勾选瑕疵原因或填写备注");
        return;
      }
    }

    setLoading(true);
    try {
      const row = await mockAction<{ id: string }>("createRepair", {
        shop_id: shopId,
        remark: remark.trim() || null,
        source: "manual",
        lines: payload,
      });
      router.push(`/repair/${row.id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}
      <Field label="店铺">
        <Select value={shopId} onChange={(e) => setShopId(e.target.value)}>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}（{s.code}）
            </option>
          ))}
        </Select>
      </Field>
      <Field label="整单备注">
        <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} />
      </Field>

      <div className="space-y-4">
        <div className="text-xs uppercase tracking-[0.14em] text-muted">明细</div>
        {lines.map((line, i) => (
          <div key={i} className="space-y-3 border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="款号">
                <Input
                  value={line.style_no}
                  onChange={(e) => updateLine(i, { style_no: e.target.value })}
                  placeholder="QC-2401"
                />
              </Field>
              <Field label="颜色">
                <Input
                  value={line.color}
                  onChange={(e) => updateLine(i, { color: e.target.value })}
                />
              </Field>
              <Field label="尺码">
                <Input
                  value={line.size}
                  onChange={(e) => updateLine(i, { size: e.target.value })}
                  placeholder="均码"
                />
              </Field>
              <Field label="退回数量">
                <Input
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">瑕疵原因</div>
              <div className="flex flex-wrap gap-3">
                {DEFECT_REASON_OPTIONS.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={line.reasons.includes(r)}
                      onChange={() => toggleReason(i, r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <Field label="自定义备注">
              <Input
                value={line.defect_note}
                onChange={(e) => updateLine(i, { defect_note: e.target.value })}
                placeholder="部位、程度等"
              />
            </Field>
            {lines.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              >
                删除本行
              </Button>
            ) : null}
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setLines((p) => [...p, emptyLine()])}>
          添加一行
        </Button>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "提交中…" : "创建返修单"}
      </Button>
    </form>
  );
}
