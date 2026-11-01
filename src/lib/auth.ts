import { createClient } from "@/lib/supabase/server";
import {
  createDevAdminUser,
  DEV_ADMIN_PROFILE,
  isDevAuthBypass,
} from "@/lib/dev-auth";
import { isMockPreview } from "@/lib/mock/mode";
import type { Profile } from "@/types/database";

/** 获取当前登录用户与资料；未登录返回 null（开发环境可回落为虚拟管理员） */
export async function getCurrentUser() {
  // Mock 预览：不访问 Supabase
  if (isMockPreview()) {
    return {
      user: createDevAdminUser(),
      profile: DEV_ADMIN_PROFILE,
      isDevBypass: true,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 已有真实会话：优先用真实用户
  if (user) {
    // 四表项目可能无 profiles；失败则回落为管理员资料，不阻断登录
    let profile: Profile | null = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      profile = (data as Profile | null) ?? null;
    } catch {
      profile = null;
    }

    return {
      user,
      profile: profile ?? {
        ...DEV_ADMIN_PROFILE,
        id: user.id,
        display_name: user.email ?? "用户",
        role: "admin" as const,
      },
      /** 是否为开发免登录虚拟身份 */
      isDevBypass: false,
    };
  }

  // 本地开发且未登录：以管理员身份放行（生产不会走这里）
  if (isDevAuthBypass()) {
    return {
      user: createDevAdminUser(),
      profile: DEV_ADMIN_PROFILE,
      isDevBypass: true,
    };
  }

  return null;
}

/** 要求已登录，否则抛错（供 Server Action 使用） */
export async function requireUser() {
  const current = await getCurrentUser();
  if (!current?.user) {
    throw new Error("请先登录");
  }
  return current;
}
