"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";

type ImportResult = {
  createdProducts: number;
  updatedProducts: number;
  createdSkus: number;
  skippedSkus: number;
  errors: string[];
  warnings?: string[];
};

/** 商品档案 Excel 批量导入（支持嵌入图片） */
export function ProductExcelImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function downloadTemplate() {
    setError("");
    try {
      const res = await fetch("/api/products/import-template");
      if (!res.ok) throw new Error("模板下载失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "商品导入模板.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "模板下载失败");
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/products/import", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "导入失败");

      const parts = [
        `新建款 ${data.createdProducts}`,
        `更新款 ${data.updatedProducts}`,
        `新建 SKU ${data.createdSkus}`,
        data.skippedSkus ? `已存在 SKU 跳过 ${data.skippedSkus}` : "",
      ].filter(Boolean);
      const warn = [...(data.warnings ?? []), ...(data.errors ?? [])];
      setInfo(
        `导入完成：${parts.join("，")}${warn.length ? `。提示：${warn.slice(0, 5).join("；")}${warn.length > 5 ? "…" : ""}` : ""}`,
      );
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => void downloadTemplate()}>
          下载模板
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? "导入中…" : "Excel 导入"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {info ? <Alert tone="ok">{info}</Alert> : null}
      <p className="max-w-md text-right text-xs text-muted">
        支持 .xlsx；可将款式图嵌入表格「图片」列。同一款号多行表示多色多码。
      </p>
    </div>
  );
}
