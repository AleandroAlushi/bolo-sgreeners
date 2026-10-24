import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { ALL_TIME, SeasonSelector } from "@/components/navigation";
import { StatsExplorer } from "@/components/stats-explorer";
import { EmptyState, Notice } from "@/components/ui";
import { getSeasons } from "@/lib/data/seasons";
import { getAllTimeStats, getStatDefinitions } from "@/lib/data/stats";
import type { TotalsRow } from "@/lib/domain/stats";

export const metadata: Metadata = {
  title: "Statistiche all time",
  description: "Leader e statistiche di tutti i giocatori Bolo Sgreeners in tutte le stagioni.",
};

async function Header() {
  const seasons = await getSeasons();
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Statistiche</p>
        <h1 className="display text-4xl leading-none sm:text-5xl">All time</h1>
      </div>
      <SeasonSelector seasons={seasons.map((s) => ({ slug: s.slug, label: s.label }))} current={ALL_TIME} />
    </div>
  );
}

async function Stats() {
  const [stats, defs] = await Promise.all([getAllTimeStats(), getStatDefinitions()]);
  if (stats.careerTotals.length === 0) {
    return <EmptyState title="Statistiche non disponibili">Non ci sono ancora statistiche dei giocatori.</EmptyState>;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Tutte le partite con statistiche di tutte le stagioni ({stats.seasons}).</p>
      {stats.careerTotals.some((t) => t.includes_historical_aggregates) && (
        <Notice>Alcuni totali includono dati storici senza dettaglio partita: nei filtri per fase non sono conteggiati.</Notice>
      )}
      <StatsExplorer
        defs={defs}
        seasonRows={stats.careerTotals as TotalsRow[]}
        competitionRows={stats.phaseTotals}
        competitions={stats.phases}
        players={stats.players}
        allLabel="Tutte le fasi"
      />
    </div>
  );
}

export default function AllTimeStatsPage() {
  return (
    <>
      <Suspense fallback={<div className="mb-6 h-16 animate-pulse rounded-2xl bg-surface" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<LoadingBlock rows={6} />}>
        <Stats />
      </Suspense>
    </>
  );
}
