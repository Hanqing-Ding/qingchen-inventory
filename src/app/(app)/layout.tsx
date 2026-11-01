import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isDevAuthBypass } from "@/lib/dev-auth";
import { isMockPreview } from "@/lib/mock/mode";
import { AppNav } from "@/components/AppNav";
import { DevBypassBanner } from "@/components/DevBypassBanner";
import type { UserRole } from "@/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mock = isMockPreview();

  // Mock 预览不强制配置 Supabase；真实模式仍需环境变量
  if (
    !mock &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">青陈时尚</h1>
        <p className="mt-4 text-sm text-muted">
          请先配置 <code className="text-ink">.env.local</code>（参考{" "}
          <code className="text-ink">.env.example</code>），并在 Supabase SQL Editor
          执行 <code className="text-ink">supabase/schema.sql</code>。
        </p>
      </main>
    );
  }

  const current = await getCurrentUser();

  if (!current?.user) {
    redirect("/login");
  }

  const role = (current.profile?.role ?? "merchandiser") as UserRole;
  const displayName = current.profile?.display_name ?? current.user.email ?? "用户";
  const showDevBanner = mock || (isDevAuthBypass() && current.isDevBypass);

  return (
    <div className="min-h-screen">
      {showDevBanner ? <DevBypassBanner /> : null}
      <AppNav displayName={displayName} role={role} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
