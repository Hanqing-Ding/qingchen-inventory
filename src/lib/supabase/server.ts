import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isMockPreview } from "@/lib/mock/mode";

/**
 * 服务端 Supabase 客户端。
 * Mock 预览模式下禁止调用，避免误连数据库导致 Internal Server Error。
 */
export async function createClient() {
  if (isMockPreview()) {
    const err = new Error(
      "[MOCK] createClient(server) 在 Mock 预览中被拦截：请走 mock store，勿查询 Supabase",
    );
    console.error(err.stack);
    throw err;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const err = new Error("[Supabase] 缺少 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
    console.error(err.stack);
    throw err;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component 中调用时可能无法写 cookie，由 middleware 刷新会话
        }
      },
    },
  });
}
