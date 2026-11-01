"use client";

import { useState } from "react";
import { downloadProductImagesZip } from "@/lib/product-images";

type ProductCard = {
  id: string;
  brand: string;
  style_no: string;
  name: string;
  category: string;
  season: string;
  image_url: string | null;
  image_urls: string[];
};

/** 拓新样册 / 拓客档案公开页：无库存、无补货返修 */
export function PublicShareClient({
  mode: _mode,
  title,
  watermark,
  products,
}: {
  mode: "lookbook" | "prospect_archive";
  title: string;
  watermark?: string | null;
  products: ProductCard[];
}) {
  void _mode;
  const [active, setActive] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState("");

  async function download(p: ProductCard) {
    setBusyId(p.id);
    try {
      await downloadProductImagesZip(p.style_no, p.image_urls);
    } finally {
      setBusyId("");
    }
  }

  const brandLine = (watermark || "青陈时尚").replace(
    /\s*[·•]\s*(拓新样册|拓客|看款选款|演示).*$/u,
    "",
  );

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-[#f7f7f5] px-4 py-8">
      <header className="mb-8 text-center">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#6b6b6b]">
          {brandLine.trim() || "青陈时尚"}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide text-[#111]">
          {title}
        </h1>
      </header>

      {!products.length ? (
        <p className="text-center text-sm text-[#6b6b6b]">暂无商品</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const idx = active[p.id] ?? 0;
            const img = p.image_urls[idx] ?? p.image_url;
            return (
              <article key={p.id} className="border border-[#e4e4e0] bg-white">
                <div
                  className="relative aspect-[3/4] bg-[#f0efec]"
                  onMouseMove={(e) => {
                    if (p.image_urls.length <= 1) return;
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const ratio = Math.min(
                      1,
                      Math.max(0, (e.clientX - rect.left) / rect.width),
                    );
                    const next = Math.min(
                      p.image_urls.length - 1,
                      Math.floor(ratio * p.image_urls.length),
                    );
                    setActive((s) => ({ ...s, [p.id]: next }));
                  }}
                  onMouseLeave={() => setActive((s) => ({ ...s, [p.id]: 0 }))}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.style_no} className="h-full w-full object-cover" />
                  ) : null}
                  {p.image_urls.length > 1 ? (
                    <div className="absolute bottom-2 left-2 bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                      {idx + 1}/{p.image_urls.length}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    title="下载图片"
                    className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#111]/85 text-white"
                    disabled={busyId === p.id || !p.image_urls.length}
                    onClick={() => void download(p)}
                  >
                    ↓
                  </button>
                </div>
                <div className="space-y-1 p-4">
                  <div className="font-medium tracking-wide">{p.style_no}</div>
                  <div className="text-sm text-[#6b6b6b]">
                    {p.brand} · {p.name}
                  </div>
                  <div className="text-xs text-[#6b6b6b]">
                    {p.category}
                    {p.season ? ` · ${p.season}` : ""}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
