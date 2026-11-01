"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExternalShareLink, ProductWithSkus } from "@/types/database";
import { isMockPreview } from "@/lib/mock/mode";
import { mockAction } from "@/lib/mock/client";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

type Props = {
  initialLinks: ExternalShareLink[];
  products: ProductWithSkus[];
};

export function ShareLinksManager({ initialLinks, products }: Props) {
  const router = useRouter();
  const [type, setType] = useState<"lookbook" | "prospect_archive">("lookbook");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand))).sort(),
    [products],
  );
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  );

  const filtered = products.filter((p) => {
    if (brand && p.brand !== brand) return false;
    if (category && p.category !== category) return false;
    return true;
  });

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  function urlFor(link: ExternalShareLink) {
    const base = link.type === "lookbook" ? "/lookbook" : "/prospect";
    return `${origin}${base}/${link.token}`;
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectFiltered() {
    setPicked(new Set(filtered.map((p) => p.id)));
  }

  async function create() {
    if (!isMockPreview()) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const link = await mockAction<ExternalShareLink>("createShareLink", {
        type,
        title,
        product_ids: Array.from(picked),
      });
      setMsg(`已生成：${urlFor(link)}`);
      setPicked(new Set());
      setTitle("");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function disable(id: string) {
    if (!confirm("确认一键停用该外链？")) return;
    await mockAction("disableShareLink", { id });
    router.refresh();
  }

  async function enable(id: string) {
    await mockAction("enableShareLink", { id });
    router.refresh();
  }

  if (!isMockPreview()) {
    return <p className="text-sm text-muted">外部分享链接管理仅 Mock 预览可用。</p>;
  }

  return (
    <div className="space-y-10">
      <section className="border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl">生成外链</h2>
        <p className="mt-1 text-xs text-muted">
          拓新样册 / 拓客商品档案：无需新建店铺。访客看不到库存与补货返修；仍受「对门店可见」过滤。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="链接类型">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as "lookbook" | "prospect_archive")}
            >
              <option value="lookbook">拓新样册链接</option>
              <option value="prospect_archive">拓客商品档案链接</option>
            </Select>
          </Field>
          <Field label="标题">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "lookbook" ? "如：秋冬拓新样册" : "如：大衣意向看款"}
            />
          </Field>
          <Field label="筛品牌">
            <Select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">全部品牌</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="筛品类">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">全部品类</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={selectFiltered}>
            勾选当前筛选结果（{filtered.length}）
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPicked(new Set())}>
            清空勾选
          </Button>
          <span className="text-xs text-muted self-center">已选 {picked.size} 款</span>
        </div>
        <div className="mt-3 max-h-64 overflow-y-auto border border-line">
          {filtered.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0"
            >
              <input
                type="checkbox"
                checked={picked.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="font-medium">{p.style_no}</span>
              <span className="text-muted">
                {p.brand} · {p.name} · {p.category}
                {p.store_visible === false ? " · 已关可见" : ""}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <Button type="button" disabled={busy || !picked.size} onClick={() => void create()}>
            {busy ? "生成中…" : "生成链接"}
          </Button>
        </div>
        {err ? (
          <div className="mt-3">
            <Alert>{err}</Alert>
          </div>
        ) : null}
        {msg ? (
          <div className="mt-3">
            <Alert tone="ok">{msg}</Alert>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">已有外链</h2>
        <div className="space-y-3">
          {initialLinks.map((link) => (
            <div key={link.id} className="border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {link.type === "lookbook" ? "拓新样册" : "拓客档案"} · {link.title}
                  </div>
                  <div className="mt-1 break-all text-xs text-muted">{urlFor(link)}</div>
                  <div className="mt-1 text-xs text-muted">
                    {link.product_ids.length} 款 · {link.enabled ? "启用中" : "已停用"} · 访问{" "}
                    {link.access_logs?.length ?? 0} 次
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void navigator.clipboard.writeText(urlFor(link))}
                  >
                    复制
                  </Button>
                  <a
                    href={urlFor(link)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-3 text-sm underline"
                  >
                    打开
                  </a>
                  {link.enabled ? (
                    <Button type="button" variant="ghost" onClick={() => void disable(link.id)}>
                      一键停用
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => void enable(link.id)}>
                      重新启用
                    </Button>
                  )}
                </div>
              </div>
              {link.access_logs?.length ? (
                <ul className="mt-3 max-h-28 overflow-y-auto border-t border-line pt-2 text-xs text-muted">
                  {link.access_logs.slice(0, 8).map((log) => (
                    <li key={log.id}>
                      {new Date(log.at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}{" "}
                      · {log.path} {log.note ? `· ${log.note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {!initialLinks.length ? (
            <p className="text-sm text-muted">暂无外链</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
