"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconCalendar, IconPin } from "./icons";
import { cx } from "./ui";

interface MenuItem {
  href: string;
  label: string;
  hint?: string;
  /** link esterno (nuova scheda) */
  external?: boolean;
}

/** Pulsante con menu a tendina: si chiude cliccando fuori o con Esc. */
function MenuButton({ icon, label, items, align = "left" }: { icon: ReactNode; label: string; items: MenuItem[]; align?: "left" | "right" | "auto" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
          open ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface/60 hover:border-primary/60 hover:text-primary",
        )}
      >
        {icon}
        {label}
        <span aria-hidden className={cx("text-xs transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className={cx(
            "absolute z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 text-left shadow-2xl shadow-black/30",
            // auto: a sinistra su telefono (pulsante a capo), a destra su schermi larghi
            align === "right" ? "right-0" : align === "auto" ? "left-0 sm:left-auto sm:right-0" : "left-0",
          )}
        >
          {items.map((it) => (
            <a
              key={it.label}
              role="menuitem"
              href={it.href}
              {...(it.external ? { target: "_blank", rel: "noreferrer" } : {})}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-text hover:bg-surface-2"
            >
              <span className="block text-sm font-semibold">{it.label}</span>
              {it.hint && <span className="block text-xs text-muted">{it.hint}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Azioni di una partita: indicazioni per la palestra e "aggiungi al calendario". */
export function MatchActions({
  directions,
  calendar,
  className,
}: {
  directions: { apple: string; google: string; waze: string } | null;
  calendar: { ics: string; google: string | null } | null;
  className?: string;
}) {
  if (!directions && !calendar) return null;
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      {directions && (
        <MenuButton
          icon={<IconPin size={16} />}
          label="Indicazioni"
          items={[
            { href: directions.apple, label: "Mappe", hint: "Apple (iPhone, Mac)", external: true },
            { href: directions.google, label: "Google Maps", external: true },
            { href: directions.waze, label: "Waze", external: true },
          ]}
        />
      )}
      {calendar && (
        <MenuButton
          icon={<IconCalendar size={16} />}
          label="Aggiungi al calendario"
          items={[
            { href: calendar.ics, label: "Apple Calendar", hint: "iPhone, iPad, Mac" },
            ...(calendar.google ? [{ href: calendar.google, label: "Google Calendar", external: true }] : []),
            { href: calendar.ics, label: "Outlook o altro", hint: "file .ics" },
          ]}
        />
      )}
    </div>
  );
}

/** Tutto il calendario della stagione: iscrizione (si aggiorna da solo) o file da scaricare. */
export function SeasonCalendarButton({ path, label = "Aggiungi tutto il calendario" }: { path: string; label?: string }) {
  // l'indirizzo webcal:// serve assoluto: si costruisce nel browser dall'host corrente
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => null,
  );
  const webcal = host ? `webcal://${host}${path}` : path;
  return (
    <MenuButton
      icon={<IconCalendar size={16} />}
      label={label}
      align="auto"
      items={[
        { href: webcal, label: "Apple Calendar", hint: "iPhone, Mac: si aggiorna da solo con orari e risultati" },
        {
          href: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
          label: "Google Calendar",
          hint: "si aggiorna da solo",
          external: true,
        },
        { href: `${path}?download=1`, label: "Scarica il file .ics", hint: "Outlook e altri calendari" },
      ]}
    />
  );
}
