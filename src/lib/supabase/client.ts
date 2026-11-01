"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isMockPreview } from "@/lib/mock/mode";

/**
 * 浏览器端 Supabase 客户端。
 * Mock 预览下禁止创建，避免表单误调真实库。
 */
export function createClient() {
  if (isMockPreview()) {
    const err = new Error(
      "[MOCK] createClient(browser) 在 Mock 预览中被拦截：请使用 mockAction / 假数据",
    );
    console.error(err.stack);
    throw err;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("[Supabase] 缺少环境变量");
  }

  return createBrowserClient(url, key);
}
