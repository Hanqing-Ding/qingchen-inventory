import * as XLSX from "xlsx";

/** 将二维表导出为 Excel 并触发浏览器下载（客户端） */
export function downloadExcel(
  rows: Record<string, string | number | null | undefined>[],
  sheetName: string,
  fileName: string,
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

/** 服务端生成 xlsx ArrayBuffer */
export function buildExcelBuffer(
  rows: Record<string, string | number | null | undefined>[],
  sheetName: string,
): ArrayBuffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
