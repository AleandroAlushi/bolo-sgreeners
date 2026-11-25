"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { jerseyRank, roleRank } from "@/lib/domain/roster";
import { publicMediaUrl } from "@/lib/media";
import { LockedPlayer } from "./odyssey";
import { RosterCard, type RosterBadge } from "./player";
import { cx } from "./ui";

export interface RosterGridItem {
  slug: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  jersey: string | null;
  role: string | null;
  photoPath: string | null;
  /** video in loop della stagione, al posto della foto */
  videoPath?: string | null;
  badges: RosterBadge[];
  /** in viaggio fino a questa data (aaaa-mm-gg), con la nota per la figurina */
  awayUntil?: string | null;
  awayNote?: string | null;
}

/** Griglia del roster ordinabile per numero di maglia o per ruolo. */
export function RosterGrid({ items }: { items: RosterGridItem[] }) {
  const [sort, setSort] = useState<"numero" | "ruolo">("numero");
  const hasRoles = items.some((i) => i.role);
  const hasVideos = items.some((i) => i.videoPath);
  const grid = useRef<HTMLDivElement>(null);
  // prova del minigioco senza i dati nel database: ?prova-odissea=<slug> nell'indirizzo
  const trial = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("prova-odissea"),
    () => null,
  );
  // data di oggi nel browser (sul server si considera ancora in viaggio): dopo awayUntil torna normale
  const today = useSyncExternalStore(
    () => () => {},
    () => new Date().toISOString().slice(0, 10),
    () => null,
  );
  // fa ripartire tutti i video insieme (e li avvia se il telefono, per esempio in risparmio energetico, non l'ha fatto)
  const replay = () =>
    grid.current?.querySelectorAll("video").forEach((v) => {
      v.currentTime = 0;
      void v.play().catch(() => {});
    });
  const sorted = [...items].sort((a, b) =>
    sort === "ruolo"
      ? roleRank(a.role) - roleRank(b.role) || jerseyRank(a.jersey) - jerseyRank(b.jersey)
      : jerseyRank(a.jersey) - jerseyRank(b.jersey) || a.lastName.localeCompare(b.lastName),
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted">{items.length} giocatori</p>
          {hasVideos && (
            <button
              type="button"
              onClick={replay}
              aria-label="Fai ripartire i video"
              title="Fai ripartire i video"
              className="grid size-8 place-items-center rounded-full border border-border bg-surface text-base text-muted hover:border-primary/60 hover:text-text"
            >
              ↻
            </button>
          )}
        </div>
        <div role="tablist" aria-label="Ordina per" className="inline-flex rounded-full border border-border bg-surface p-1">
          {(["numero", "ruolo"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={sort === s}
              disabled={s === "ruolo" && !hasRoles}
              title={s === "ruolo" && !hasRoles ? "I ruoli non sono ancora stati inseriti" : undefined}
              onClick={() => setSort(s)}
              className={cx("rounded-full px-3 py-1 text-sm font-semibold capitalize disabled:opacity-40", sort === s ? "bg-primary text-primary-ink" : "text-muted")}
            >
              {s === "numero" ? "Numero" : "Ruolo"}
            </button>
          ))}
        </div>
      </div>
      <div ref={grid} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map(({ awayUntil: until, awayNote: note, ...p }) => {
          const awayUntil = trial === p.slug ? "9999-12-31" : until;
          const awayNote = trial === p.slug ? (note ?? "Torno a marzo") : note;
          // lontano per un po': personaggio da sbloccare con il minigioco; dopo la data torna normale
          if (awayUntil && (today === null || today <= awayUntil)) {
            return (
              <LockedPlayer
                key={p.slug}
                slug={p.slug}
                name={p.nickname ?? p.firstName}
                silhouette={publicMediaUrl(`easter-egg/sagome/${p.slug}.png`)!}
                photo={publicMediaUrl(p.photoPath)}
                unlocked={<RosterCard {...p} badges={[...p.badges, "unlocked"]} away={awayNote ?? "In viaggio"} />}
              />
            );
          }
          return <RosterCard key={p.slug} {...p} />;
        })}
      </div>
    </div>
  );
}
