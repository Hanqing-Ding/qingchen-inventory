import { redirect } from "next/navigation";

/** 外部分享已合并到「合作店铺与分享」 */
export default function SharesRedirectPage() {
  redirect("/shops?tab=shares");
}
