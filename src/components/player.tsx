/** Componenti giocatore e staff: avatar, card del roster ("figurina"), card dello staff. */
import Link from "next/link";
import type { ReactNode } from "react";
import { publicMediaUrl } from "@/lib/media";
import { cx } from "./ui";

export function PlayerAvatar({
  name,
  photoPath,
  jersey,
  size = 56,
}: {
  name: string;
  photoPath?: string | null;
  jersey?: string | null;
  size?: number;
}) {
  const url = publicMediaUrl(photoPath);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagini su Supabase Storage, dimensioni ridotte
        <img src={url} alt={name} className="h-full w-full rounded-full object-cover" />
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
      <PlayerAvatar name={`${firstName} ${lastName}`} photoPath={photoPath} jersey={jersey} />
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

/** Card del roster in stile figurina: foto, numero gigante, ruolo e badge. */
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
  const url = publicMediaUrl(photoPath);
  return (
    <Link
      href={`/giocatori/${slug}`}
      className="glow-panel group relative block aspect-[4/5] rounded-2xl border border-border transition-colors hover:border-primary/60"
    >
      {jersey && (
        <span aria-hidden className="display pointer-events-none absolute right-3 top-1 text-[6.5rem] leading-none text-white/90 drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)] sm:text-[7.5rem]">
          {jersey}
        </span>
      )}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto su Supabase Storage
        <img src={url} alt="" className="absolute inset-x-0 bottom-0 h-[82%] w-full object-cover object-top" />
      ) : (
        <span aria-hidden className="display absolute inset-x-0 bottom-16 text-center text-[5.5rem] leading-none text-white/10">
          {firstName[0]}
          {lastName[0]}
        </span>
      )}
      {badges.length > 0 && (
        <span className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {badges.map((b) => (
            <span
              key={b}
              title={BADGE_LABEL[b]}
              className={cx(
                "rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider",
                b === "captain" || b === "vice" ? "bg-gold text-black" : b === "new" ? "bg-primary text-primary-ink" : "bg-black/60 text-sky ring-1 ring-sky/40",
              )}
            >
              {BADGE_SHORT[b]}
            </span>
          ))}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-10">
        <span className="block truncate text-xs text-text/75">{firstName}</span>
        <span className="display block truncate text-3xl leading-[0.9] group-hover:text-primary">{lastName}</span>
        <span className="mt-1 flex items-baseline justify-between gap-2">
          {nickname ? <span className="accent-serif truncate text-sm text-text/85">{nickname}</span> : <span />}
          {role && <span className="eyebrow shrink-0 text-[0.58rem] text-secondary">{role}</span>}
        </span>
      </span>
    </Link>
  );
}

/** Card di un membro dello staff. */
export function StaffCard({
  name,
  role,
  photoPath,
  playerSlug,
  gamesAsPlayer,
  extra,
}: {
  name: string;
  role: string;
  photoPath?: string | null;
  playerSlug?: string | null;
  gamesAsPlayer?: number | null;
  extra?: ReactNode;
}) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <PlayerAvatar name={name} photoPath={photoPath} size={64} />
      <div className="min-w-0">
        <p className="eyebrow text-[0.62rem] text-secondary">{role}</p>
        <p className="display truncate text-2xl leading-tight">{name}</p>
        {extra && <div className="text-sm text-muted">{extra}</div>}
        {playerSlug && (
          <Link href={`/giocatori/${playerSlug}`} className="text-sm font-semibold text-primary hover:underline">
            {gamesAsPlayer ? `Ha giocato ${gamesAsPlayer} ${gamesAsPlayer === 1 ? "partita" : "partite"} in stagione` : "Scheda giocatore"} →
          </Link>
        )}
      </div>
    </div>
  );
}
