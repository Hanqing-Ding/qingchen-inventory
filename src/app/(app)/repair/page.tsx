import { redirect } from "next/navigation";

/** 返修列表已合并到「补货与返修」 */
export default async function RepairListRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ tab: "repair" });
  if (sp.status?.trim()) q.set("status", sp.status.trim());
  redirect(`/replenish?${q.toString()}`);
}
