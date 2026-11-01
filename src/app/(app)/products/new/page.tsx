import { redirect } from "next/navigation";

/** 新建商品已合并到库存与建档页 */
export default function NewProductRedirectPage() {
  redirect("/inventory#create");
}
