/** Componenti giocatore e staff: avatar, card del roster ("figurina"), card dello staff. */
import Link from "next/link";
import type { ReactNode } from "react";
import { publicMediaUrl } from "@/lib/media";
import { PhotoButton } from "./photo-viewer";
import { cx } from "./ui";

/** Ritaglio del viso per il tondino: angolo e lato del quadrato in frazioni della larghezza della foto. */
export type AvatarCrop = { x: number; y: number; s: number };

export function parseAvatarCrop(value: unknown): AvatarCrop | null {
  if (!value || typeof value !== "object") return null;
  const { x, y, s } = value as Record<string, unknown>;
  return typeof x === "number" && typeof y === "number" && typeof s === "number" && s > 0 ? { x, y, s } : null;
}

export function PlayerAvatar({
  name,
  photoPath,
  jersey,
  size = 56,
  crop,
}: {
  name: string;
  photoPath?: string | null;
  jersey?: string | null;
  size?: number;
  /** ritaglio del viso (season_rosters.avatar_crop); senza, si mostra la parte alta della foto */
  crop?: unknown;
}) {
  const url = publicMediaUrl(photoPath);
  const c = parseAvatarCrop(crop);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <span className="relative block h-full w-full overflow-hidden rounded-full bg-surface-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- immagini su Supabase Storage, dimensioni ridotte */}
          <img
            src={url}
            alt={name}
            className={c ? "absolute max-w-none" : "h-full w-full object-cover object-[50%_18%]"}
            // il quadrato del viso riempie il tondino: la foto si ingrandisce di 1/s e si sposta
            style={c ? { width: `${100 / c.s}%`, left: `${(-c.x / c.s) * 100}%`, top: `${(-c.y / c.s) * 100}%` } : undefined}
          />
        </span>
      ) : (
        <span
          className="display flex h-full w-full items-center justify-center rounded-full bg-surface-3 text-muted"
          style={{ fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      )}
      {jersey !== null && jersey !== undefined && (
        <span className="display absolute -bottom-1 -right-1 min-w-[1.6rem] rounded-full bg-primary px-1 text-center text-xs leading-5 text-primary-ink">
          {jersey}
        </span>
      )}
    </span>
  );
}

export function PlayerCard({
  slug,
  firstName,
  lastName,
  nickname,
  jersey,
  role,
  photoPath,
  avatarCrop,
  meta,
  inactive,
}: {
  slug: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  jersey?: string | null;
  role?: string | null;
  photoPath?: string | null;
  avatarCrop?: unknown;
  meta?: string;
  inactive?: boolean;
}) {
  return (
    <Link
      href={`/giocatori/${slug}`}
      className={cx("card group relative flex items-center gap-3 overflow-hidden p-3 transition-colors hover:border-primary/40", inactive && "opacity-60")}
    >
      {jersey && (
        <span aria-hidden className="display pointer-events-none absolute -right-2 -top-4 text-7xl text-white/[0.04]">
          {jersey}
        </span>
      )}
      <PlayerAvatar name={`${firstName} ${lastName}`} photoPath={photoPath} crop={avatarCrop} jersey={jersey} />
      <div className="min-w-0">
        <p className="truncate text-sm text-muted">{firstName}</p>
        <p className="display truncate text-xl leading-tight group-hover:text-primary">{lastName}</p>
        <p className="truncate text-xs text-muted">
          {[nickname && `“${nickname}”`, role, meta].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

export type RosterBadge = "captain" | "vice" | "new" | "staff";
const BADGE_LABEL: Record<RosterBadge, string> = { captain: "Capitano", vice: "Vice capitano", new: "Nuovo arrivo", staff: "Staff" };
const BADGE_SHORT: Record<RosterBadge, string> = { captain: "C", vice: "VC", new: "New", staff: "Staff" };

/**
 * Cornice della figurina (giocatori e staff): foto a tutto riquadro 4:5, centrata sul viso,
 * angolo in alto a destra in primo piano su vetro sfocato, nome in basso.
 */
function Figurina({
  photoUrl,
  initials,
  corner,
  badges,
  children,
}: {
  photoUrl: string | null;
  initials: string;
  corner?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto su Supabase Storage
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          // le foto caricate sono già ritagliate 4:5; per le altre conta il terzo alto, dove sta il viso
          className="absolute inset-0 h-full w-full object-cover object-[50%_30%] transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <span aria-hidden className="display absolute inset-x-0 top-[22%] text-center text-[5.5rem] leading-none text-white/10">
          {initials}
        </span>
      )}
      {/* velo in alto: numero e badge leggibili anche su foto chiare */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/35 to-transparent" />
      {corner && <span className="pointer-events-none absolute right-2 top-2 z-10">{corner}</span>}
      {badges && <span className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1">{badges}</span>}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-12">{children}</span>
    </>
  );
}

/** Vetro sfocato in primo piano: il numero (o il ruolo) si legge intero sopra la foto. */
function GlassCorner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "display block rounded-xl bg-black/25 px-2.5 pt-1 leading-none text-white shadow-[0_6px_24px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/20 backdrop-blur-md [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

const initialsOf = (...parts: string[]) =>
  parts
    .map((w) => w.trim()[0] ?? "")
    .join("")
    .toUpperCase();

/** Card del roster in stile figurina: foto, numero in primo piano, ruolo e badge. */
export function RosterCard({
  slug,
  firstName,
  lastName,
  nickname,
  jersey,
  role,
  photoPath,
  badges,
}: {
  slug: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  jersey?: string | null;
  role?: string | null;
  photoPath?: string | null;
  badges: RosterBadge[];
}) {
  return (
    <Link
      href={`/giocatori/${slug}`}
      className="glow-panel lift group relative block aspect-[4/5] rounded-2xl border border-border hover:border-primary/60"
    >
      <Figurina
        photoUrl={publicMediaUrl(photoPath)}
        initials={initialsOf(firstName, lastName)}
        corner={jersey ? <GlassCorner className="text-5xl sm:text-6xl">{jersey}</GlassCorner> : undefined}
        badges={
          badges.length > 0
            ? badges.map((b) => (
                <span
                  key={b}
                  title={BADGE_LABEL[b]}
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider shadow",
                    b === "captain" || b === "vice" ? "bg-gold text-black" : b === "new" ? "bg-primary text-primary-ink" : "bg-black/60 text-sky ring-1 ring-sky/40",
                  )}
                >
                  {BADGE_SHORT[b]}
                </span>
              ))
            : undefined
        }
      >
        <span className="block truncate text-xs text-text/75">{firstName}</span>
        <span className="display block truncate text-3xl leading-[0.9] group-hover:text-primary">{lastName}</span>
        <span className="mt-1 flex items-baseline justify-between gap-2">
          {nickname ? <span className="accent-serif truncate text-sm text-text/85">{nickname}</span> : <span />}
          {role && <span className="eyebrow shrink-0 text-[0.58rem] text-secondary">{role}</span>}
        </span>
      </Figurina>
    </Link>
  );
}

/** Nome breve del ruolo per l'angolo della figurina: su una riga, senza coprire il viso. */
const SHORT_ROLES: Record<string, string> = {
  "dirigente accompagnatore": "Accompagnatore",
  "vice allenatore": "Vice",
  "preparatore atletico": "Preparatore",
};
export const shortRole = (role: string) => SHORT_ROLES[role.trim().toLowerCase()] ?? role;

/** Card di un membro dello staff: la stessa figurina dei giocatori, con il ruolo al posto del numero. */
export function StaffCard({
  firstName,
  lastName,
  role,
  photoPath,
  playerSlug,
  gamesAsPlayer,
  extra,
  photoIndex,
}: {
  firstName: string;
  lastName: string;
  role: string;
  photoPath?: string | null;
  playerSlug?: string | null;
  gamesAsPlayer?: number | null;
  extra?: ReactNode;
  /** posizione della foto nel PhotoViewer della pagina: toccandola si apre in grande */
  photoIndex?: number;
}) {
  return (
    <div className="glow-panel group relative aspect-[4/5] rounded-2xl border border-border">
      {photoPath && photoIndex !== undefined && (
        <PhotoButton index={photoIndex} label={`Apri la foto di ${firstName} ${lastName}`} className="absolute inset-0 z-[5] cursor-zoom-in rounded-2xl" />
      )}
      <Figurina
        photoUrl={publicMediaUrl(photoPath)}
        initials={initialsOf(firstName, lastName)}
        corner={
          <span title={role}>
            <GlassCorner className="whitespace-nowrap px-2 pb-1 text-base leading-[0.95] sm:text-lg">{shortRole(role)}</GlassCorner>
          </span>
        }
      >
        <span className="block truncate text-xs text-text/75">{firstName}</span>
        <span className="display block truncate text-3xl leading-[0.9]">{lastName}</span>
        {extra && <span className="mt-1 block truncate text-xs text-text/80">{extra}</span>}
        {playerSlug && (
          <Link href={`/giocatori/${playerSlug}`} className="pointer-events-auto mt-1 block truncate text-xs font-semibold text-primary hover:underline">
            {gamesAsPlayer ? `${gamesAsPlayer} ${gamesAsPlayer === 1 ? "partita giocata" : "partite giocate"}` : "Scheda giocatore"} →
          </Link>
        )}
      </Figurina>
    </div>
  );
}
