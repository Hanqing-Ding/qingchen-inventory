import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

/**
 * 本地开发免登录开关。
 * - `next dev` 时 NODE_ENV=development → 自动跳过登录校验
 * - `next build` / `next start` 生产部署 → 必须真实登录
 * 可用 DEV_BYPASS_AUTH=false 在本地强制关闭免登录（便于自测登录流）
 */
export function isDevAuthBypass(): boolean {
  if (process.env.DEV_BYPASS_AUTH === "false") return false;
  if (process.env.DEV_BYPASS_AUTH === "true") return true;
  return process.env.NODE_ENV === "development";
}

/** 开发免登录时使用的虚拟管理员（仅 UI / 服务端身份判断，非真实 Auth 会话） */
export const DEV_ADMIN_PROFILE: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  display_name: "开发管理员",
  role: "admin",
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

/** 构造虚拟 User，满足页面展示与权限判断 */
export function createDevAdminUser(): User {
  return {
    id: DEV_ADMIN_PROFILE.id,
    app_metadata: { provider: "dev-bypass" },
    user_metadata: { display_name: DEV_ADMIN_PROFILE.display_name, role: "admin" },
    aud: "authenticated",
    created_at: DEV_ADMIN_PROFILE.created_at,
    email: "dev-admin@localhost",
    role: "authenticated",
    updated_at: DEV_ADMIN_PROFILE.updated_at,
  } as User;
}
