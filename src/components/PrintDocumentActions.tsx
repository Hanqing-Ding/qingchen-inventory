"use client";

import { Button } from "@/components/ui";

/**
 * 浏览器原生打印 / 另存为 PDF（无第三方 PDF 库，适配线下仓库出纸）。
 * Chrome / Edge：打印对话框 → 目标打印机选「另存为 PDF」。
 */
export function PrintDocumentActions({
  printLabel = "打印单据",
  pdfLabel = "导出 PDF",
}: {
  printLabel?: string;
  pdfLabel?: string;
}) {
  function doPrint() {
    window.print();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={doPrint}>
        {printLabel}
      </Button>
      <Button type="button" variant="secondary" onClick={doPrint}>
        {pdfLabel}
      </Button>
      <p className="w-full text-xs text-muted sm:w-auto">
        导出 PDF：在打印对话框将打印机选为「另存为 PDF / Save as PDF」。
      </p>
    </div>
  );
}
