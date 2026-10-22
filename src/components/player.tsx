/** Componenti giocatore: avatar e card del roster. */
import Link from "next/link";
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
