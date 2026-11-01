"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMockPreview } from "@/lib/mock/mode";
import { ROLE_LABEL, type UserRole, canEditMaster } from "@/types/database";
import { Button } from "@/components/ui";

const links = [
  { href: "/dashboard", label: "看板" },
  { href: "/inventory", label: "库存与建档" },
  { href: "/products", label: "商品档案" },
  { href: "/inbound", label: "入库" },
  { href: "/replenish", label: "补货与返修" },
  { href: "/shipments", label: "出库单" },
  { href: "/shops", label: "合作店铺与分享" },
  { href: "/movements", label: "库存流水" },
];

export function AppNav({
  displayName,
  role,
}: {
  displayName: string;
  role: UserRole;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    if (!isMockPreview()) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (e) {
        console.error(e);
      }
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/inventory" className="group">
            <div className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-ink">
              青陈时尚
            </div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted">
              服装出入库
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              {displayName} · {ROLE_LABEL[role]}
              {!canEditMaster(role) ? "（不可改价/档案）" : ""}
            </span>
            <Button type="button" variant="ghost" onClick={logout}>
              退出
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-1">
          {links.map((link) => {
            const active =
              link.href === "/replenish"
                ? pathname.startsWith("/replenish") || pathname.startsWith("/repair")
                : link.href === "/shops"
                  ? pathname.startsWith("/shops") || pathname.startsWith("/shares")
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-ink text-white"
                    : "text-muted hover:bg-background hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
