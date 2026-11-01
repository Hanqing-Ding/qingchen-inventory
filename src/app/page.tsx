import { redirect } from "next/navigation";

/** 根路径进入库存总表（中间件会拦截未登录） */
export default function HomePage() {
  redirect("/inventory");
}
