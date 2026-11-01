"use client";

import { useCallback, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { downloadProductImagesZip } from "@/lib/product-images";

type Props = {
  styleNo: string;
  name: string;
  images: string[];
  href: string;
  meta?: string;
};

const SWIPE_THRESHOLD = 36;

/**
 * 档案列表卡片：悬停在图上即可左右滑/拖看多图；图右下角一键下载，无需弹层或进详情。
 */
export function ProductQuickPreview({ styleNo, name, images, href, meta }: Props) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const current = images[active] ?? null;
  const multi = images.length > 1;

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    setActive((a) => (a - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setActive((a) => (a + 1) % images.length);
  }, [images.length]);

  /** 悬停时按鼠标 X 位置切图（电商常见预览） */
  function scrubByClientX(clientX: number) {
    if (!multi || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const index = Math.min(images.length - 1, Math.floor(ratio * images.length));
    setActive(index);
  }

  function pointerDown(x: number) {
    startX.current = x;
    deltaX.current = 0;
    setDragging(true);
  }

  function pointerMove(x: number) {
    if (startX.current == null) return;
    deltaX.current = x - startX.current;
    setDragOffset(deltaX.current);
  }

  function pointerUp() {
    if (startX.current == null) {
      setDragging(false);
      setDragOffset(0);
      return;
    }
    const d = deltaX.current;
    startX.current = null;
    setDragging(false);
    setDragOffset(0);
    if (Math.abs(d) >= SWIPE_THRESHOLD) {
      if (d < 0) goNext();
      else goPrev();
    }
  }

  async function downloadAll(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !images.length) return;
    setErr("");
    setBusy(true);
    try {
      await downloadProductImagesZip(styleNo, images);
    } catch (errVal: unknown) {
      setErr(errVal instanceof Error ? errVal.message : "下载失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group border border-line bg-surface transition hover:border-ink">
      <div
        ref={frameRef}
        className="relative aspect-[3/4] touch-pan-y select-none overflow-hidden bg-background"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          if (startX.current != null) pointerUp();
          else setActive(0);
        }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-download]")) return;
          pointerDown(e.clientX);
        }}
        onMouseMove={(e) => {
          if (startX.current != null) pointerMove(e.clientX);
          else if (hovered) scrubByClientX(e.clientX);
        }}
        onMouseUp={() => pointerUp()}
        onTouchStart={(e) => pointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => pointerMove(e.touches[0].clientX)}
        onTouchEnd={() => pointerUp()}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={name}
            draggable={false}
            style={{
              transform: `translateX(${dragging ? dragOffset * 0.35 : 0}px)`,
              transition: dragging ? "none" : "transform 0.18s ease, opacity 0.15s ease",
            }}
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">无图</div>
        )}

        {/* 悬停分段指示条 */}
        {multi ? (
          <div className="pointer-events-none absolute inset-x-2 top-2 flex gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-0.5 flex-1 rounded-full transition ${
                  i === active ? "bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>
        ) : null}

        {multi && hovered ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1">
            <span className="bg-black/25 px-1.5 py-3 text-lg leading-none text-white/90">‹</span>
            <span className="bg-black/25 px-1.5 py-3 text-lg leading-none text-white/90">›</span>
          </div>
        ) : null}

        {/* 右下角一键下载图标 */}
        <button
          type="button"
          data-download
          title={busy ? "打包中…" : "一键下载图片"}
          aria-label="一键下载图片"
          disabled={busy || !images.length}
          onClick={(e) => void downloadAll(e)}
          className="absolute bottom-2.5 right-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-ink/85 text-white shadow-md transition hover:bg-ink disabled:opacity-50"
        >
          {busy ? (
            <span className="text-[10px] leading-none">…</span>
          ) : (
            <DownloadIcon />
          )}
        </button>

        {multi ? (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
            {active + 1}/{images.length}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={href} className="font-medium tracking-wide hover:underline">
            {styleNo}
          </Link>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            {images.length} 图 · 悬停滑看
          </span>
        </div>
        <p className="truncate text-sm text-muted">{name}</p>
        {meta ? <p className="text-xs text-muted">{meta}</p> : null}
        {err ? <p className="text-xs text-red-700">{err}</p> : null}
      </div>
    </article>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17v2.2A1.8 1.8 0 0 0 5.8 21h12.4A1.8 1.8 0 0 0 20 19.2V17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
