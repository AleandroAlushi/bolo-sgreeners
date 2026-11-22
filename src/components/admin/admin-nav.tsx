"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "../ui";

/**
 * Menu dell'area admin: a gruppi nella colonna a sinistra (computer), barra in basso sul telefono.
 * Chi ha il ruolo "Statistiche" vede solo Oggi, Grafiche e la diretta. Le pagine che non si usano
 * più stanno in Archivio.
 */
type Item = { href: string; label: string; adminOnly?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Partita",
    items: [
      { href: "/admin", label: "Oggi" },
      { href: "/admin/partite", label: "Partite", adminOnly: true },
      { href: "/admin/grafiche", label: "Grafiche" },
    ],
  },
  {
    title: "Squadra",
    items: [
      { href: "/admin/giocatori", label: "Giocatori", adminOnly: true },
      { href: "/admin/staff", label: "Staff", adminOnly: true },
      { href: "/admin/foto", label: "Foto e video", adminOnly: true },
      { href: "/admin/area-squadra", label: "Area squadra", adminOnly: true },
    ],
  },
  {
    title: "Campionato",
    items: [
      { href: "/admin/stagioni", label: "Stagioni e classifiche", adminOnly: true },
      { href: "/admin/squadre", label: "Squadre", adminOnly: true },
    ],
  },
  {
    title: "Altro",
    items: [
      { href: "/admin/feedback", label: "Feedback", adminOnly: true },
      { href: "/admin/archivio", label: "Archivio", adminOnly: true },
    ],
  },
];

const LIVE = "/area-squadra/live";
const active = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

function Dot() {
  return <span aria-hidden className="size-2 animate-pulse rounded-full bg-loss motion-reduce:animate-none" />;
}

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  // il pannello "Altro" resta aperto solo sulla pagina in cui lo si è aperto
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === path;
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) })).filter((g) => g.items.length > 0);
  // barra in basso: le pagine di tutti i giorni; il resto in "Altro"
  const tabs = isAdmin ? ["/admin", "/admin/partite", "/admin/grafiche"] : ["/admin", "/admin/grafiche"];
  const all = groups.flatMap((g) => g.items);
  const rest = all.filter((i) => !tabs.includes(i.href));
  const tab = (href: string) => all.find((i) => i.href === href)!;

  return (
    <>
      {/* computer: colonna a sinistra */}
      <nav aria-label="Area admin" className="hidden flex-col gap-4 md:flex">
        <Link
          href={LIVE}
          className="flex items-center gap-2 rounded-lg bg-loss/10 px-3 py-2 text-sm font-bold text-loss ring-1 ring-loss/40 hover:bg-loss/15"
        >
          <Dot />
          Statistiche live
        </Link>
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-1">
            <p className="eyebrow px-3 text-[0.6rem] text-muted">{g.title}</p>
            {g.items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(path, n.href) ? "page" : undefined}
                className={cx(
                  "rounded-lg px-3 py-2 text-sm font-semibold",
                  active(path, n.href) ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* telefono: barra in basso, come un'app */}
      <div className="md:hidden">
        {more && rest.length > 0 && (
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-40 px-3">
            <div className="card mx-auto max-w-md space-y-3 p-3 shadow-2xl">
              {groups
                .map((g) => ({ ...g, items: g.items.filter((i) => rest.includes(i)) }))
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.title}>
                    <p className="eyebrow px-2 pb-1 text-[0.6rem] text-muted">{g.title}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {g.items.map((n) => (
                        <Link
                          key={n.href}
                          href={n.href}
                          className={cx("rounded-lg px-3 py-2.5 text-sm font-semibold", active(path, n.href) ? "bg-surface-2 text-text" : "text-muted")}
                        >
                          {n.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        <nav
          aria-label="Area admin"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur"
        >
          <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
            <BarLink href="/admin" label="Oggi" on={active(path, "/admin")} />
            <Link href={LIVE} className="flex flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-bold text-loss">
              <span className="flex size-7 items-center justify-center rounded-full bg-loss/15 ring-1 ring-loss/40">
                <Dot />
              </span>
              Live
            </Link>
            {tabs.slice(1).map((href) => (
              <BarLink key={href} href={href} label={tab(href).label} on={active(path, href)} />
            ))}
            {rest.length > 0 && (
              <button
                type="button"
                onClick={() => setMoreAt(more ? null : path)}
                aria-expanded={more}
                className={cx("flex flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold", more || rest.some((i) => active(path, i.href)) ? "text-text" : "text-muted")}
              >
                <span aria-hidden className="text-lg leading-none">
                  ⋯
                </span>
                Altro
              </button>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}

function BarLink({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cx("flex flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold", on ? "text-text" : "text-muted")}
    >
      <span aria-hidden className={cx("h-1 w-6 rounded-full", on ? "bg-primary" : "bg-transparent")} />
      {label}
    </Link>
  );
}
