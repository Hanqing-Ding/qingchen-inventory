"use client";

import { PrintDocumentActions } from "@/components/PrintDocumentActions";

export function PrintActions({
  printLabel = "打印出库单",
  pdfLabel = "导出出库单 PDF",
}: {
  printLabel?: string;
  pdfLabel?: string;
} = {}) {
  return <PrintDocumentActions printLabel={printLabel} pdfLabel={pdfLabel} />;
}
