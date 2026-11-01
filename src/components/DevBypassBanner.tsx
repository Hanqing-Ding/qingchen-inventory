import Link from "next/link";
import { isMockPreview } from "@/lib/mock/mode";

/** 开发免登录 / Mock 预览提示条 */
export function DevBypassBanner() {
  const mock = isMockPreview();
  return (
    <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
      {mock ? (
        <>
          <strong className="mr-1">Mock 预览模式</strong>
          当前展示假数据（商品 / 店铺 / 补货单），不读写 Supabase。
          上线或联调真实库时设置 <code className="mx-1">NEXT_PUBLIC_USE_MOCK_DATA=false</code>。
        </>
      ) : (
        <>
          本地开发免登录：已按<strong className="mx-1">管理员</strong>进入。
          上线部署将恢复登录校验。可先{" "}
          <Link href="/login" className="underline">
            登录真实账号
          </Link>
          。
        </>
      )}
    </div>
  );
}
