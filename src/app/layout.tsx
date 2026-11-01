import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "青陈时尚 · 服装出入库",
  description: "青陈时尚服装出入库管理系统",
};

/**
 * 中文现代无衬线：优先系统「阿里巴巴普惠体 / 思源黑体 / OPPO Sans」；
 * 网页兜底加载 Noto Sans SC（思源黑体同源），避免 next/font/google + turbopack 500。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router 无 _document；故意用 link 避开 next/font/google + turbopack 500 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
