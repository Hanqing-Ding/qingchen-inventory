import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "青陈时尚 · 店铺门户",
  description: "合作店铺货品目录与补货申请",
};

/** 外部门户布局：与内部后台完全隔离，无管理导航 */
export default function StorePortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f7f7f5] text-[#111]">{children}</div>;
}
