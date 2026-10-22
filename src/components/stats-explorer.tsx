"use client";

import { useState } from "react";
import type { StatDefinition, TotalsRow } from "@/lib/domain/stats";
import { Leaderboard, TotalsTable, type PlayerRef } from "./stats";
import { SectionTitle, cx } from "./ui";

interface Props {
  defs: StatDefinition[];
  seasonRows: TotalsRow[];
  competitionRows: (TotalsRow & { competition_id: string | null })[];
  competitions: { id: string; name: string }[];
  players: PlayerRef[];
}

/** Classifiche statistiche della stagione con filtro per fase (regular season, playoff, ...). */
export function StatsExplorer({ defs, seasonRows, competitionRows, competitions, players }: Props) {
  const [phase, setPhase] = useState<string>("all");
  const rows = phase === "all" ? seasonRows : competitionRows.filter((r) => r.competition_id === phase);
  const boards = defs.filter((d) => d.show_in_leaderboards);
  const tableRows = [...rows]
    .sort((a, b) => Number(b.points ?? 0) - Number(a.points ?? 0))
    .map((r) => {
      const p = players.find((x) => x.id === r.player_id);
      return p ? { ...r, label: p.display_name, href: `/giocatori/${p.slug}` } : null;
    })
    .filter((r) => r !== null);

  return (
    <div className="space-y-8">
      {competitions.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex min-w-max rounded-full border border-border bg-surface p-1">
            {[{ id: "all", name: "Tutta la stagione" }, ...competitions].map((c) => (
              <button
                key={c.id}
                onClick={() => setPhase(c.id)}
                aria-pressed={phase === c.id}
                className={cx("rounded-full px-3 py-1 text-sm font-semibold", phase === c.id ? "bg-primary text-primary-ink" : "text-muted")}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <section>
        <SectionTitle eyebrow="Classifiche">Leader</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((d) => (
            <Leaderboard key={d.key} def={d} rows={rows} players={players} />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle eyebrow="Giocatori">Totali e medie</SectionTitle>
        <TotalsTable rows={tableRows} firstHeader="Giocatore" />
        <p className="mt-2 text-xs text-muted">
          Le medie sono calcolate sulle partite in cui la statistica è stata registrata (alcune gare hanno dati parziali).
        </p>
      </section>
    </div>
  );
}
