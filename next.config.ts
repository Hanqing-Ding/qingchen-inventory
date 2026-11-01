import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Render / Docker 生产镜像更省内存
  output: "standalone",
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
