/**
 * 开发预览 Mock 模式：不依赖 Supabase，使用内存假数据。
 * - next dev 默认开启
 * - NEXT_PUBLIC_USE_MOCK_DATA=false 可关闭并走真实库
 * - 生产构建默认关闭
 */
export function isMockPreview(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "false") return false;
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") return true;
  return process.env.NODE_ENV === "development";
}
