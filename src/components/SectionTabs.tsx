import Link from "next/link";

type Tab = { id: string; label: string; href: string };

/** 合并页内切换区块（服务端友好的链接 Tab） */
export function SectionTabs({ tabs, active }: { tabs: Tab[]; active: string }) {
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-line pb-0">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              on
                ? "border-ink font-medium text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
