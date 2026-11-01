"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { downloadProductImagesZip } from "@/lib/product-images";
import { mockAction } from "@/lib/mock/client";
import { isMockPreview } from "@/lib/mock/mode";
import { Alert, Button } from "@/components/ui";

type Props = {
  productId: string;
  styleNo: string;
  images: string[];
  /** 白底图 URL（库存/表单用；档案中固定为最后一张） */
  whiteBgUrl?: string | null;
  /** 内部可编辑；门户只读 */
  canEdit: boolean;
  onImagesChange?: (urls: string[]) => void;
};

const SWIPE_THRESHOLD = 48;

/** 商品档案样图：其他图在前，白底图固定最后；左右滑 + 一键下载 */
export function ProductArchiveGallery({
  productId,
  styleNo,
  images: initialImages,
  whiteBgUrl: initialWhite,
  canEdit,
  onImagesChange,
}: Props) {
  const [images, setImages] = useState(initialImages);
  const [whiteBgUrl, setWhiteBgUrl] = useState<string | null>(
    initialWhite ?? initialImages[initialImages.length - 1] ?? null,
  );
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const pointerStartX = useRef<number | null>(null);
  const pointerDeltaX = useRef(0);
  const ignoreClick = useRef(false);

  useEffect(() => {
    setImages(initialImages);
    setWhiteBgUrl(initialWhite ?? initialImages[initialImages.length - 1] ?? null);
    setActive(0);
  }, [initialImages, initialWhite]);

  const current = images[active] ?? null;

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    setActive((a) => (a - 1 + images.length) % images.length);
    setZoom(1);
  }, [images.length]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setActive((a) => (a + 1) % images.length);
    setZoom(1);
  }, [images.length]);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, goPrev, goNext]);

  function onPointerDown(clientX: number) {
    if (zoom > 1) return;
    pointerStartX.current = clientX;
    pointerDeltaX.current = 0;
    setDragging(true);
  }

  function onPointerMove(clientX: number) {
    if (pointerStartX.current == null || zoom > 1) return;
    pointerDeltaX.current = clientX - pointerStartX.current;
    setDragOffset(pointerDeltaX.current);
  }

  function onPointerUp() {
    if (pointerStartX.current == null) return;
    const delta = pointerDeltaX.current;
    pointerStartX.current = null;
    setDragging(false);
    setDragOffset(0);
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      ignoreClick.current = true;
      if (delta < 0) goNext();
      else goPrev();
      window.setTimeout(() => {
        ignoreClick.current = false;
      }, 80);
    }
  }

  const persist = useCallback(
    async (next: string[], white: string | null) => {
      const w = white && next.includes(white) ? white : next[next.length - 1] ?? null;
      const others = next.filter((u) => u !== w);
      const ordered = w ? [...others, w] : others;
      setImages(ordered);
      setWhiteBgUrl(w);
      onImagesChange?.(ordered);
      if (!canEdit) return;
      if (isMockPreview()) {
        await mockAction("updateProductImages", {
          productId,
          image_urls: ordered,
          white_bg_url: w,
        });
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("clothing_styles")
        .update({ cover_img: w, updated_at: new Date().toISOString() })
        .eq("id", productId);
      if (error) throw error;
    },
    [canEdit, onImagesChange, productId],
  );

  async function onAddFiles(files: FileList | null) {
    if (!canEdit || !files?.length) return;
    setErr("");
    const readers = Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("读图失败"));
          reader.readAsDataURL(file);
        }),
    );
    try {
      const urls = await Promise.all(readers);
      // 新图插在白底图之前
      const white = whiteBgUrl && images.includes(whiteBgUrl) ? whiteBgUrl : null;
      const others = images.filter((u) => u !== white);
      await persist([...others, ...urls, ...(white ? [white] : [])], white);
      setMsg(`已添加 ${urls.length} 张样图（白底图仍在最后）`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "上传失败");
    }
  }

  async function removeAt(index: number) {
    if (!canEdit) return;
    const removed = images[index];
    const next = images.filter((_, i) => i !== index);
    const white = removed === whiteBgUrl ? next[next.length - 1] ?? null : whiteBgUrl;
    await persist(next, white);
    setActive((a) => Math.min(a, Math.max(0, next.length - 1)));
  }

  async function markAsWhite(url: string) {
    if (!canEdit) return;
    await persist(images, url);
    setMsg("已设为白底图（排在档案最后，并用于库存/表单）");
  }

  async function downloadAll() {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await downloadProductImagesZip(styleNo, images);
      setMsg("已开始下载压缩包");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "打包下载失败");
    } finally {
      setBusy(false);
    }
  }

  const swipeHandlers = {
    onTouchStart: (e: React.TouchEvent) => onPointerDown(e.touches[0].clientX),
    onTouchMove: (e: React.TouchEvent) => onPointerMove(e.touches[0].clientX),
    onTouchEnd: () => onPointerUp(),
    onMouseDown: (e: React.MouseEvent) => onPointerDown(e.clientX),
    onMouseMove: (e: React.MouseEvent) => {
      if (pointerStartX.current != null) onPointerMove(e.clientX);
    },
    onMouseUp: () => onPointerUp(),
    onMouseLeave: () => {
      if (pointerStartX.current != null) onPointerUp();
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.14em] text-muted">
          {canEdit
            ? `款式样图 · ${images.length} 张 · 白底图在最后 · 左右滑动`
            : `款式样图 · ${images.length} 张`}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !images.length}
            onClick={() => void downloadAll()}
          >
            {busy ? "打包中…" : "一键下载图片"}
          </Button>
          {canEdit ? (
            <label className="inline-flex cursor-pointer items-center border border-ink px-4 py-2 text-sm hover:bg-ink hover:text-white">
              上传样图
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void onAddFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </div>

      {err ? <Alert>{err}</Alert> : null}
      {msg ? <Alert tone="ok">{msg}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px]">
        <div
          className="relative aspect-[3/4] max-h-[70vh] w-full touch-pan-y select-none overflow-hidden border border-line bg-background"
          {...swipeHandlers}
        >
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current}
              alt={styleNo}
              draggable={false}
              style={{
                transform: `translateX(${dragging ? dragOffset : 0}px)`,
                transition: dragging ? "none" : "transform 0.2s ease",
              }}
              className="h-full w-full object-contain"
              onClick={() => {
                if (ignoreClick.current) return;
                setZoom(1);
                setLightbox(true);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">暂无样图</div>
          )}
          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="上一张"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-ink/70 px-2 py-3 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="下一张"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-ink/70 px-2 py-3 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
              >
                ›
              </button>
            </>
          ) : null}
          {current ? (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
              <span className="bg-ink/80 px-2 py-1 text-[10px] tracking-wider text-white">
                {active + 1}/{images.length}
                {canEdit
                  ? current === whiteBgUrl
                    ? " · 白底图"
                    : " · 滑动切图"
                  : ""}
              </span>
              {canEdit ? (
                <span className="bg-ink/80 px-2 py-1 text-[10px] tracking-wider text-white">
                  点击放大预览
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex max-h-[70vh] gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto">
          {images.map((url, i) => {
            const isWhite = url === whiteBgUrl;
            return (
              <div key={`${url.slice(0, 32)}-${i}`} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={`h-24 w-20 overflow-hidden border ${
                    i === active ? "border-ink" : "border-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
                {canEdit && isWhite ? (
                  <span className="absolute bottom-0 left-0 right-0 bg-ink/85 text-center text-[9px] text-white">
                    白底图
                  </span>
                ) : null}
                {canEdit ? (
                  <div className="absolute left-0 right-0 top-0 flex justify-between">
                    {!isWhite ? (
                      <button
                        type="button"
                        className="bg-white/90 px-1 text-[9px]"
                        title="设为白底图"
                        onClick={() => void markAsWhite(url)}
                      >
                        白底
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="bg-white/90 px-1 text-[10px] text-red-700"
                      onClick={() => void removeAt(i)}
                    >
                      删
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {lightbox && current ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/92"
          role="dialog"
          aria-modal
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white">
            <span className="text-sm">
              {styleNo} · {active + 1}/{images.length}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !images.length}
                className="bg-white text-ink hover:bg-neutral-200"
                onClick={() => void downloadAll()}
              >
                {busy ? "打包中…" : "一键下载图片"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="border-white text-white hover:bg-white hover:text-ink"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
              >
                放大
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="border-white text-white hover:bg-white hover:text-ink"
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
              >
                缩小
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-white"
                onClick={() => setLightbox(false)}
              >
                关闭
              </Button>
            </div>
          </div>

          <div
            className="relative flex flex-1 touch-pan-y select-none items-center justify-center overflow-hidden p-4"
            {...swipeHandlers}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={styleNo}
              draggable={false}
              style={{
                transform: `translateX(${dragging && zoom === 1 ? dragOffset : 0}px) scale(${zoom})`,
                transition: dragging ? "none" : "transform 0.2s ease",
              }}
              className="max-h-[78vh] max-w-[92vw] origin-center object-contain"
            />
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="上一张"
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/15 px-3 py-4 text-2xl text-white backdrop-blur"
                  onClick={goPrev}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="下一张"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/15 px-3 py-4 text-2xl text-white backdrop-blur"
                  onClick={goNext}
                >
                  ›
                </button>
              </>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-3 px-4 pb-6">
            {canEdit ? (
              <p className="text-xs text-white/70">左右滑动或点箭头切换 · 键盘 ← →</p>
            ) : null}
            <div className="flex max-w-full gap-2 overflow-x-auto">
              {images.map((url, i) => (
                <button
                  key={`lb-${i}`}
                  type="button"
                  onClick={() => {
                    setActive(i);
                    setZoom(1);
                  }}
                  className={`h-14 w-11 shrink-0 overflow-hidden border ${
                    i === active ? "border-white" : "border-white/30"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <Button
              type="button"
              disabled={busy || !images.length}
              className="min-w-[12rem] bg-white text-ink hover:bg-neutral-200"
              onClick={() => void downloadAll()}
            >
              {busy ? "打包中…" : "一键下载图片"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
