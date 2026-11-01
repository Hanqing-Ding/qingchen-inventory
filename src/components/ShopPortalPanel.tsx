"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Shop } from "@/types/database";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import { Alert, Button } from "@/components/ui";

/** 合作店铺详情：生成 / 复制 / 停用门户分享链接 */
export function ShopPortalPanel({ shop }: { shop: Shop }) {
  const router = useRouter();
  const [token, setToken] = useState(shop.portal_token ?? "");
  const [enabled, setEnabled] = useState(Boolean(shop.portal_enabled && shop.portal_token));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const shareUrl = useMemo(() => {
    if (!token || !enabled) return "";
    return `${origin}/store-portal/${token}`;
  }, [origin, token, enabled]);

  if (!isMockPreview()) {
    return (
      <div className="mb-8 border border-line bg-surface p-4 text-sm text-muted">
        店铺门户分享链接在 Mock 预览模式下可用。联调真实库后将落库密钥字段。
      </div>
    );
  }

  async function generate() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const updated = await mockAction<Shop>("generatePortalLink", { shopId: shop.id });
      setToken(updated.portal_token ?? "");
      setEnabled(Boolean(updated.portal_enabled));
      setMsg("已生成新的分享链接（密钥已轮换）");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    if (!confirm("停用后店铺将无法打开此链接，确认？")) return;
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      await mockAction("disablePortalLink", { shopId: shop.id });
      setEnabled(false);
      setMsg("链接已停用");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "停用失败");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMsg("链接已复制");
    } catch {
      setErr("复制失败，请手动选择链接复制");
    }
  }

  return (
    <section className="mb-10 border border-line bg-surface p-4 sm:p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl text-ink">店铺门户分享</h2>
      <p className="mt-1 text-xs text-muted">
        生成密钥链接发给合作店：免登录查看本店货品目录，并可提交补货需求到后台。
      </p>

      <div className="mt-4 space-y-3">
        {shareUrl ? (
          <div className="break-all border border-dashed border-line bg-background px-3 py-2 text-xs">
            {shareUrl}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {token && !enabled ? "链接已停用，可重新生成启用。" : "尚未生成分享链接。"}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={generate} disabled={loading}>
            {token ? "重新生成链接" : "生成分享链接"}
          </Button>
          <Button type="button" variant="secondary" onClick={copy} disabled={!shareUrl || loading}>
            复制链接
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={disable}
            disabled={!token || !enabled || loading}
          >
            一键停用链接
          </Button>
          {shareUrl ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3 text-sm underline"
            >
              打开门户预览
            </a>
          ) : null}
        </div>

        {err ? <Alert>{err}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}

        {shop.portal_access_logs?.length ? (
          <div className="mt-4 border-t border-line pt-3">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">访问日志</div>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-muted">
              {shop.portal_access_logs.slice(0, 12).map((log) => (
                <li key={log.id}>
                  {new Date(log.at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                  {log.note ? ` · ${log.note}` : ""} · {log.path}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">尚无访问记录（打开门户预览后会写入）。</p>
        )}
      </div>
    </section>
  );
}
