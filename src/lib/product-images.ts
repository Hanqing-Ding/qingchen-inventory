import {
  buildProductImages,
  getArchiveExtraImages,
  getProductImages,
  getWhiteBgImage,
} from "@/types/database";

export {
  buildProductImages,
  getArchiveExtraImages,
  getProductImages,
  getWhiteBgImage,
};

/** 将多图打包为 zip 并触发浏览器下载（客户端） */
export async function downloadProductImagesZip(
  styleNo: string,
  urls: string[],
): Promise<void> {
  if (!urls.length) throw new Error("该款暂无图片");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const folder = zip.folder(styleNo.replace(/[^\w\u4e00-\u9fa5-]+/g, "_") || "product")!;

  await Promise.all(
    urls.map(async (url, index) => {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`下载第 ${index + 1} 张图失败`);
      const blob = await res.blob();
      const ext =
        blob.type.includes("png")
          ? "png"
          : blob.type.includes("webp")
            ? "webp"
            : blob.type.includes("gif")
              ? "gif"
              : "jpg";
      folder.file(`${String(index + 1).padStart(2, "0")}.${ext}`, blob);
    }),
  );

  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = `${styleNo || "product"}_样图.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
