import Link from "next/link";
import { cx } from "./ui";

/** Schede della sezione Squadra (Roster | Staff) e link all'archivio di tutti i giocatori. */
export function TeamTabs({ seasonSlug, active }: { seasonSlug: string; active: "roster" | "staff" }) {
  const tabs = [
    { key: "roster", href: `/stagioni/${seasonSlug}/squadra`, label: "Roster" },
    { key: "staff", href: `/stagioni/${seasonSlug}/squadra/staff`, label: "Staff" },
  ] as const;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full border border-border bg-surface p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={cx("rounded-full px-4 py-1.5 text-sm font-semibold", active === t.key ? "bg-primary text-primary-ink" : "text-muted hover:text-text")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Link href="/giocatori" className="text-sm font-semibold text-primary hover:underline">
        Tutti gli Sgreeners di sempre →
      </Link>
    </div>
  );
}
