import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDevAuthBypass } from "@/lib/dev-auth";
import { isMockPreview } from "@/lib/mock/mode";

/** 中间件中刷新会话，并拦截未登录访问 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Mock 预览 / 开发免登录 / 未配置 env：放行
  if (isMockPreview() || isDevAuthBypass() || !url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  // 外部分享：店铺门户 / 拓新样册 / 拓客档案，密钥链接无需登录
  const isExternalShare =
    path.startsWith("/store-portal") ||
    path.startsWith("/lookbook") ||
    path.startsWith("/prospect");
  const isPublicAsset =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.endsWith(".ico");

  if (!user && !isLogin && !isExternalShare && !isPublicAsset) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/inventory";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
