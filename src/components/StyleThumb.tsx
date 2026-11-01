/** 款式缩略图（表格/打印通用） */
export function StyleThumb({
  src,
  alt = "",
  className = "h-12 w-9",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden bg-background ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-muted">无图</div>
      )}
    </div>
  );
}
