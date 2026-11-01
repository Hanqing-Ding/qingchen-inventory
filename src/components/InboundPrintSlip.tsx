"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { PrintDocumentActions } from "@/components/PrintDocumentActions";

export type InboundSlipLine = {
  order_no: string;
  style_no: string;
  color: string;
  size: string;
  quantity: number;
};

/** 入库单打印模板（A4 / 浏览器另存 PDF） */
export function InboundPrintSlip({
  lines,
  onClose,
}: {
  lines: InboundSlipLine[];
  onClose?: () => void;
}) {
  const printedAt = useMemo(() => format(new Date(), "yyyy-MM-dd HH:mm"), []);
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const primaryNo = lines[0]?.order_no ?? "—";

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/40 p-4 print:static print:bg-transparent print:p-0">
      <div className="print-sheet mx-auto max-w-3xl border border-line bg-surface p-6 md:p-10">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="text-sm text-muted underline" onClick={onClose}>
            关闭
          </button>
          <PrintDocumentActions printLabel="打印入库单" pdfLabel="导出入库单 PDF" />
        </div>

        <header className="mb-8 border-b border-ink pb-4 text-center">
          <div className="font-[family-name:var(--font-display)] text-3xl tracking-[0.16em]">
            青陈时尚
          </div>
          <div className="mt-2 text-sm uppercase tracking-[0.28em] text-muted">
            入库单 · 仓库签收
          </div>
        </header>

        <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted">入库单号：</span>
            <strong>{primaryNo}</strong>
            {lines.length > 1 ? (
              <span className="text-muted">（本页 {lines.length} 笔）</span>
            ) : null}
          </div>
          <div>
            <span className="text-muted">打印时间：</span>
            {printedAt}
          </div>
          <div>
            <span className="text-muted">合计件数：</span>
            <strong className="tabular-nums">{total}</strong>
          </div>
          <div>
            <span className="text-muted">来源：</span>
            快捷入库
          </div>
        </div>

        <table className="mb-10 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-ink text-left">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">单号</th>
              <th className="py-2 pr-2">款号</th>
              <th className="py-2 pr-2">颜色</th>
              <th className="py-2 pr-2">尺码</th>
              <th className="py-2 text-right">数量</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={`${line.order_no}-${idx}`} className="border-b border-line">
                <td className="py-2 pr-2">{idx + 1}</td>
                <td className="py-2 pr-2">{line.order_no}</td>
                <td className="py-2 pr-2 font-medium">{line.style_no}</td>
                <td className="py-2 pr-2">{line.color}</td>
                <td className="py-2 pr-2">{line.size}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="border-t border-line pt-3">入库人签字：</div>
          <div className="border-t border-line pt-3">仓管签字：</div>
        </div>
      </div>
    </div>
  );
}
