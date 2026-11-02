"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { IconArchive, IconCalendar, IconChart, IconHome, IconMessage, IconTrophy, IconUsers } from "./icons";
import { cx } from "./ui";

const SEASON_SECTIONS = ["calendario", "classifica", "squadra", "statistiche"] as const;

/**
 * Stagione a cui puntano i menu: quella della pagina aperta (/stagioni/<stagione>/…), così dopo
 * averne scelta una dal selettore i link restano su quell'anno; altrimenti quella in evidenza.
 */
function seasonBase(pathname: string, fallback: string | null) {
  const fromPath = pathname.match(/^\/stagioni\/([^/]+)/)?.[1];
  const slug = fromPath ?? fallback;
  return slug ? `/stagioni/${slug}` : "/stagioni";
}

const subscribePath = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};

/**
 * Percorso della pagina anche quando i *View fanno da fallback (pathname ""): sulla home la barra
 * restava il fallback e nessun tasto risultava attivo finché non si cambiava pagina. Sul server
 * resta "", nel browser si legge dall'indirizzo.
 */
function useKnownPath(pathname: string) {
  const fromBrowser = useSyncExternalStore(subscribePath, () => window.location.pathname, () => "");
  return pathname || fromBrowser;
}

/**
 * I componenti *View non leggono l'URL: sono usati anche come fallback di <Suspense>,
 * perché con Cache Components usePathname sospende sulle route con parametri dinamici.
 */
export function BottomNav({ seasonSlug }: { seasonSlug: string | null }) {
  return <BottomNavView seasonSlug={seasonSlug} pathname={usePathname()} />;
}

/** Barra di navigazione inferiore (mobile). */
export function BottomNavView({ seasonSlug, pathname: given }: { seasonSlug: string | null; pathname: string }) {
  const pathname = useKnownPath(given);
  const base = seasonBase(pathname, seasonSlug);
  const items: { href: string; label: string; icon: ReactNode; match: (p: string) => boolean }[] = [
    { href: "/", label: "Home", icon: <IconHome />, match: (p) => p === "/" },
    { href: `${base}/calendario`, label: "Partite", icon: <IconCalendar />, match: (p) => p.endsWith("/calendario") || p.startsWith("/partite") },
    { href: `${base}/classifica`, label: "Classifica", icon: <IconTrophy />, match: (p) => p.endsWith("/classifica") },
    { href: `${base}/statistiche`, label: "Stats", icon: <IconChart />, match: (p) => p.endsWith("/statistiche") },
    { href: `${base}/squadra`, label: "Squadra", icon: <IconUsers />, match: (p) => p.startsWith("/giocatori") || p.includes("/squadra") },
  ];
  return (
    <nav aria-label="Navigazione principale" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 backdrop-blur-lg md:hidden">
      <ul className="mx-auto flex max-w-lg justify-around">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <li key={it.label}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cx("press flex flex-col items-center gap-0.5 px-2 pb-2 pt-2 text-[0.65rem] font-semibold transition-colors", active ? "text-primary" : "text-muted")}
              >
                {/* "pillolo" dietro l'icona della sezione attiva */}
                <span
                  className={cx(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300",
                    active ? "bg-primary/15 scale-100" : "scale-90 bg-transparent",
                  )}
                >
                  {it.icon}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopNavLinks({ seasonSlug }: { seasonSlug: string | null }) {
  return <TopNavLinksView seasonSlug={seasonSlug} pathname={usePathname()} />;
}

/** Link del menu in alto (desktop): sono anche le sezioni della stagione scelta. */
export function TopNavLinksView({ seasonSlug, pathname: given }: { seasonSlug: string | null; pathname: string }) {
  const pathname = useKnownPath(given);
  const base = seasonBase(pathname, seasonSlug);
  const items = [
    { href: base, label: "Panoramica" },
    { href: `${base}/calendario`, label: "Calendario" },
    { href: `${base}/classifica`, label: "Classifica" },
    { href: `${base}/squadra`, label: "Squadra" },
    { href: `${base}/statistiche`, label: "Statistiche" },
    { href: "/stagioni", label: "Archivio", icon: <IconArchive size={16} /> },
  ];
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {items.map((it) => {
        const active =
          pathname === it.href ||
          (it.href.endsWith("/squadra") && (pathname.startsWith(it.href) || pathname.startsWith("/giocatori"))) ||
          (it.href.endsWith("/statistiche") && pathname === "/statistiche") ||
          (it.href.endsWith("/calendario") && pathname.startsWith("/partite"));
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              className={cx(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                active ? "bg-primary text-primary-ink" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {it.icon}
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function FeedbackLink() {
  return <FeedbackLinkView pathname={usePathname()} />;
}

/** Link ai feedback (idee e segnalazioni): porta con sé la pagina da cui si parte. */
export function FeedbackLinkView({ pathname }: { pathname: string }) {
  const from = pathname && pathname !== "/feedback" ? `?da=${encodeURIComponent(pathname)}` : "";
  return (
    <Link
      href={`/feedback${from}`}
      title="Feedback: idee e segnalazioni"
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-2 hover:text-text",
        pathname === "/feedback" ? "text-primary" : "text-muted",
      )}
    >
      <IconMessage size={16} />
      <span className="hidden lg:inline">Feedback</span>
    </Link>
  );
}

export const ALL_TIME = "all-time";

/**
 * Selettore di stagione: cambia stagione mantenendo la sezione corrente. Nelle statistiche
 * c'è anche "All time" (tutte le stagioni insieme, pagina /statistiche).
 */
export function SeasonSelector({ seasons, current }: { seasons: { slug: string; label: string }[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const section = SEASON_SECTIONS.find((s) => pathname.endsWith(`/${s}`));
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Stagione</span>
      <select
        value={current}
        onChange={(e) =>
          router.push(e.target.value === ALL_TIME ? "/statistiche" : `/stagioni/${e.target.value}${section ? `/${section}` : ""}`)
        }
        className="display appearance-none rounded-full border border-border bg-surface-2 py-1.5 pl-4 pr-9 text-lg text-text focus:border-primary focus:outline-none"
      >
        {seasons.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.slug}
          </option>
        ))}
        {section === "statistiche" && <option value={ALL_TIME}>All time</option>}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3 text-primary">
        ▾
      </span>
    </label>
  );
}
