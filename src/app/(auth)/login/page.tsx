"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/inventory";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Mock 预览：免登录直接进入
    if (isMockPreview()) {
      router.push(redirect);
      router.refresh();
      return;
    }

    if (!email.trim() || !password) {
      setError("请填写邮箱和密码");
      return;
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError("未配置 Supabase 环境变量，请复制 .env.example 为 .env.local 并填入项目信息");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signError) {
      setError(signError.message || "登录失败");
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-[0.12em] text-ink">
          青陈时尚
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.32em] text-muted">
          服装出入库系统
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 border border-line bg-surface p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)]"
      >
        <Field label="邮箱">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field label="密码">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </Button>
      </form>
    </main>
  );
}
