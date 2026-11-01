"use client";

import { useEffect } from "react";

/** 全局错误兜底：打印完整堆栈到控制台，便于排查 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[页面错误]", error.message);
    console.error(error.stack);
  }, [error]);

  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">出错了</h1>
      <p className="mt-3 text-sm text-muted break-all">{error.message}</p>
      <button
        type="button"
        className="mt-6 border border-ink px-4 py-2 text-sm"
        onClick={reset}
      >
        重试
      </button>
    </main>
  );
}
