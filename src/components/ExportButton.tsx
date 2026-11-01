"use client";

import { Button } from "@/components/ui";
import { downloadExcel } from "@/lib/excel";

type Props = {
  rows: Record<string, string | number | null | undefined>[];
  sheetName: string;
  fileName: string;
  label?: string;
};

/** 客户端 Excel 导出按钮 */
export function ExportButton({ rows, sheetName, fileName, label = "导出 Excel" }: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={!rows.length}
      onClick={() => downloadExcel(rows, sheetName, fileName)}
    >
      {label}
    </Button>
  );
}
