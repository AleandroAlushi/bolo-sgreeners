"use client";

import { useState } from "react";
import { PER_30_MIN_MINUTES, per30, per30Minutes, type StatDefinition, type TotalsRow } from "@/lib/domain/stats";
import { Leaderboard, TotalsTable, type PlayerRef, type TotalsMode } from "./stats";
import { SectionTitle, cx } from "./ui";

const per30Rank = (r: TotalsRow) => {
  const minutes = per30Minutes(r, "points") ?? 0;
  const pts = per30(r, "points") ?? -1;
  return (minutes >= PER_30_MIN_MINUTES ? 1000 : 0) + pts;
};

interface Props {
  defs: StatDefinition[];
  seasonRows: TotalsRow[];
  competitionRows: (TotalsRow & { competition_id: string | null })[];
  competitions: { id: string; name: string }[];
  players: PlayerRef[];
  /** etichetta del filtro senza fase */
  allLabel?: string;
}

const MODES: { id: TotalsMode; label: string }[] = [
  { id: "totali", label: "Totali e medie" },
  { id: "per30", label: "Per 30 minuti" },
];

/** Scelta tra totali/medie a partita e valori per 30 minuti. */
export function ModeToggle({ mode, onChange }: { mode: TotalsMode; onChange: (m: TotalsMode) => void }) {
  return (
    <div role="tablist" aria-label="Tipo di statistiche" className="inline-flex rounded-full border border-border bg-surface p-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => onChange(m.id)}
          className={cx("rounded-full px-3 py-1 text-sm font-semibold", mode === m.id ? "bg-secondary text-black" : "text-muted")}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function Per30Note() {
  return (
    <p className="mt-2 text-xs text-muted">
      Per 30 minuti: quanto produrrebbe il giocatore in 30 minuti in campo (le nostre partite durano 40&apos;, come i &ldquo;per 36&rdquo;
      dell&apos;NBA su 48&apos;). Contano solo le partite con i minuti registrati; sotto i {PER_30_MIN_MINUTES} minuti i valori sono in grigio perché
      poco indicativi.
    </p>
  );
}

/** Classifiche statistiche della stagione (o di tutte) con filtro per fase (regular season, playoff, ...). */
export function StatsExplorer({ defs, seasonRows, competitionRows, competitions, players, allLabel = "Tutta la stagione" }: Props) {
  const [phase, setPhase] = useState<string>("all");
  const [mode, setMode] = useState<TotalsMode>("totali");
  const rows = phase === "all" ? seasonRows : competitionRows.filter((r) => r.competition_id === phase);
  const boards = defs.filter((d) => d.show_in_leaderboards && (mode === "per30") === (d.kind === "per_30"));
  const tableRows = [...rows]
    // per 30': prima chi ha giocato abbastanza, poi per punti per 30'
    .sort((a, b) => (mode === "per30" ? per30Rank(b) - per30Rank(a) : Number(b.points ?? 0) - Number(a.points ?? 0)))
    .map((r) => {
      const p = players.find((x) => x.id === r.player_id);
      return p ? { ...r, label: p.display_name, href: `/giocatori/${p.slug}` } : null;
    })
    .filter((r) => r !== null);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <ModeToggle mode={mode} onChange={setMode} />
        {competitions.length > 1 && (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="inline-flex min-w-max rounded-full border border-border bg-surface p-1">
              {[{ id: "all", name: allLabel }, ...competitions].map((c) => (
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
      </div>
      <section>
        <SectionTitle eyebrow={mode === "per30" ? "Classifiche per 30 minuti" : "Classifiche"}>Leader</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((d) => (
            <Leaderboard key={d.key} def={d} rows={rows} players={players} />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle eyebrow="Giocatori">{mode === "per30" ? "Per 30 minuti" : "Totali e medie"}</SectionTitle>
        <TotalsTable rows={tableRows} firstHeader="Giocatore" mode={mode} />
        {mode === "per30" ? (
          <Per30Note />
        ) : (
          <p className="mt-2 text-xs text-muted">
            Le medie sono calcolate sulle partite in cui la statistica è stata registrata (alcune gare hanno dati parziali).
          </p>
        )}
      </section>
    </div>
  );
}

type TotalsLikeRow = Parameters<typeof TotalsTable>[0]["rows"][number];

/** Tabelle della scheda giocatore (stagione per stagione e per fase) con un'unica scelta totali / per 30'. */
export function PlayerTotals({
  seasonRows,
  careerRow,
  competitionRows,
}: {
  seasonRows: TotalsLikeRow[];
  careerRow: TotalsLikeRow | null;
  competitionRows: TotalsLikeRow[];
}) {
  const [mode, setMode] = useState<TotalsMode>("totali");
  return (
    <>
      {seasonRows.length > 0 && (
        <section>
          <SectionTitle eyebrow="Stagione per stagione">Statistiche</SectionTitle>
          <div className="mb-3">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <TotalsTable rows={seasonRows} firstHeader="Stagione" totalRow={careerRow} mode={mode} />
          {mode === "per30" && <Per30Note />}
        </section>
      )}
      {competitionRows.length > 1 && (
        <section>
          <SectionTitle eyebrow="Per fase">Regular season, poule e playoff</SectionTitle>
          <TotalsTable rows={competitionRows} firstHeader="Fase" mode={mode} />
        </section>
      )}
    </>
  );
}
