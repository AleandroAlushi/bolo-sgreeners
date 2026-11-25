"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconCalendar, IconDownload, IconExternal, IconPin, IconShare } from "./icons";
import { cx } from "./ui";

interface MenuItem {
  /** link; in alternativa un'azione (onSelect) */
  href?: string;
  onSelect?: () => void;
  label: string;
  hint?: string;
  /** link esterno (nuova scheda) */
  external?: boolean;
  icon?: ReactNode;
}

/** Pulsante con menu a tendina: si chiude cliccando fuori o con Esc. */
function MenuButton({ icon, label, items, align = "left" }: { icon: ReactNode; label: string; items: MenuItem[]; align?: "left" | "right" | "auto" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // posizione del menu rispetto al pulsante, calcolata all'apertura perché non esca dallo schermo:
  // si allinea al bordo sinistro o destro del pulsante e poi si sposta quanto serve (margine 8 px)
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const toggle = () => {
    if (open) return setOpen(false);
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      const vw = document.documentElement.clientWidth;
      const width = Math.min(288, vw - 16);
      const wantRight = align === "right" || (align === "auto" && vw >= 640) || r.left + width > vw - 8;
      let left = wantRight ? r.width - width : 0;
      left = Math.max(8 - r.left, Math.min(left, vw - 8 - width - r.left));
      setBox({ left, width });
    }
    setOpen(true);
  };
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
        onClick={toggle}
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
            // in primo piano, pieno (non trasparente), con un'entrata breve
            "absolute z-50 mt-2 origin-top rounded-2xl border border-border bg-surface p-1.5 text-left shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] ring-1 ring-black/5 motion-safe:animate-[sg-menu-in_0.16s_ease-out]",
          )}
          style={{ left: box?.left ?? 0, width: box?.width ?? 288 }}
        >
          {items.map((it) => (
            <a
              key={it.label}
              role="menuitem"
              href={it.href ?? "#"}
              {...(it.external ? { target: "_blank", rel: "noreferrer" } : {})}
              onClick={(e) => {
                if (it.onSelect) {
                  e.preventDefault();
                  it.onSelect();
                }
                setOpen(false);
              }}
              className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-text transition-colors hover:bg-surface-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-primary ring-1 ring-border transition-colors group-hover:bg-primary/15">
                {it.icon ?? icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{it.label}</span>
                {it.hint && <span className="block text-xs leading-snug text-muted">{it.hint}</span>}
              </span>
              {it.external && <IconExternal size={14} className="shrink-0 text-muted transition-colors group-hover:text-text" />}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Informazioni di una partita da condividere (a un genitore, a un amico che viene a vedere). */
export interface ShareInfo {
  /** "Bolo Sgreeners - Borgo Boars" */
  title: string;
  /** "lunedì 30 novembre, ore 22:15" */
  when: string | null;
  /** palestra e indirizzo */
  where: string | null;
  /** link a Google Maps (si apre anche su iPhone) */
  map: string | null;
  /** percorso della pagina della partita, es. /partite/<id> */
  path: string;
}

function shareText(s: ShareInfo, origin: string) {
  return [
    `🏀 ${s.title}`,
    s.when && `📅 ${s.when[0].toUpperCase()}${s.when.slice(1)}`,
    s.where && `📍 ${s.where}`,
    s.map && `🗺️ Come arrivare: ${s.map}`,
    `ℹ️ Tutte le info: ${origin}${s.path}`,
    "",
    "Vieni a fare il tifo! 💚",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** Pulsante "Condividi": messaggio pronto con avversario, giorno, ora, palestra e mappa. */
function ShareButton({ info }: { info: ShareInfo }) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  const text = () => shareText(info, window.location.origin);
  const copy = async () => {
    await navigator.clipboard.writeText(text());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <MenuButton
      icon={<IconShare size={16} />}
      label={copied ? "Copiato ✓" : "Condividi"}
      align="right"
      items={[
        ...(canShare ? [{ label: "Condividi…", hint: "con le app del telefono", onSelect: () => void navigator.share({ text: text() }).catch(() => {}) }] : []),
        { label: "WhatsApp", hint: "messaggio pronto da inviare", onSelect: () => window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, "_blank", "noreferrer") },
        { label: "Copia il messaggio", hint: "orario, palestra e link alla mappa", onSelect: () => void copy() },
      ]}
    />
  );
}

/** Azioni di una partita: indicazioni per la palestra e, se è ancora da giocare, "Condividi". */
export function MatchActions({
  directions,
  share,
  className,
}: {
  directions: { apple: string; google: string; waze: string } | null;
  share: ShareInfo | null;
  className?: string;
}) {
  if (!directions && !share) return null;
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      {directions && (
        <MenuButton
          icon={<IconPin size={16} />}
          label="Indicazioni"
          items={[
            { href: directions.apple, label: "Mappe", hint: "Apple, su iPhone e Mac", external: true },
            { href: directions.google, label: "Google Maps", hint: "Android e browser", external: true },
            { href: directions.waze, label: "Waze", hint: "navigatore con il traffico", external: true },
          ]}
        />
      )}
      {share && <ShareButton info={share} />}
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
        { href: `${path}?download=1`, label: "Scarica il file .ics", hint: "Outlook e altri calendari", icon: <IconDownload size={18} /> },
      ]}
    />
  );
}
