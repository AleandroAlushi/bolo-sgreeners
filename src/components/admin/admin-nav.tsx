"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";

/** Menu dell'area admin, a gruppi. Le pagine che non si usano più stanno in Archivio. */
const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Partita",
    items: [
      { href: "/admin", label: "Oggi" },
      { href: "/admin/partite", label: "Partite" },
      { href: "/admin/grafiche", label: "Grafiche" },
    ],
  },
  {
    title: "Squadra",
    items: [
      { href: "/admin/giocatori", label: "Giocatori" },
      { href: "/admin/staff", label: "Staff" },
      { href: "/admin/area-squadra", label: "Area squadra" },
    ],
  },
  {
    title: "Campionato",
    items: [
      { href: "/admin/stagioni", label: "Stagioni e classifiche" },
      { href: "/admin/squadre", label: "Squadre" },
    ],
  },
  {
    title: "Altro",
    items: [
      { href: "/admin/feedback", label: "Feedback" },
      { href: "/admin/archivio", label: "Archivio" },
    ],
  },
];

const active = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Area admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-4 md:overflow-visible md:px-0">
      {/* la diretta: sempre a portata di dito, anche dal telefono */}
      <Link
        href="/area-squadra/live"
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-loss/10 px-3 py-2 text-sm font-bold text-loss ring-1 ring-loss/40 hover:bg-loss/15"
      >
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-loss motion-reduce:animate-none" />
        Statistiche live
      </Link>
      {GROUPS.map((g) => (
        <div key={g.title} className="flex shrink-0 gap-1 md:flex-col">
          <p className="eyebrow hidden px-3 text-[0.6rem] text-muted md:block">{g.title}</p>
          {g.items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(path, n.href) ? "page" : undefined}
              className={cx(
                "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold",
                active(path, n.href) ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {n.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
