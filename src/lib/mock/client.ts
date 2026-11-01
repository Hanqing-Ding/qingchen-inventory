"use client";

/** 客户端调用 Mock API（开发预览写操作） */
export async function mockAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch("/api/mock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Mock 操作失败");
  }
  return data as T;
}
