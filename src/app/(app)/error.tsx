"use client";

import { useEffect } from "react";

/** 后台布局错误兜底 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[后台页面错误]", error.message);
    console.error(error.stack);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">页面加载失败</h1>
      <p className="mt-3 text-sm text-muted break-all">{error.message}</p>
      <p className="mt-2 text-xs text-muted">详细堆栈已打印到服务端 / 浏览器控制台</p>
      <button
        type="button"
        className="mt-6 border border-ink px-4 py-2 text-sm"
        onClick={reset}
      >
        重试
      </button>
    </div>
  );
}
