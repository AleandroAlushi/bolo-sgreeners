"use client";

import { useState } from "react";
import { jerseyRank, roleRank } from "@/lib/domain/roster";
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
  badges: RosterBadge[];
}

/** Griglia del roster ordinabile per numero di maglia o per ruolo. */
export function RosterGrid({ items }: { items: RosterGridItem[] }) {
  const [sort, setSort] = useState<"numero" | "ruolo">("numero");
  const hasRoles = items.some((i) => i.role);
  const sorted = [...items].sort((a, b) =>
    sort === "ruolo"
      ? roleRank(a.role) - roleRank(b.role) || jerseyRank(a.jersey) - jerseyRank(b.jersey)
      : jerseyRank(a.jersey) - jerseyRank(b.jersey) || a.lastName.localeCompare(b.lastName),
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{items.length} giocatori</p>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((p) => (
          <RosterCard key={p.slug} {...p} />
        ))}
      </div>
    </div>
  );
}
