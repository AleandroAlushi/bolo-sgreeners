import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { StatsExplorer } from "@/components/stats-explorer";
import { EmptyState, Notice } from "@/components/ui";
import { resolveSeason } from "@/lib/data/params";
import { getSeasonStats, getStatDefinitions } from "@/lib/data/stats";
import type { TotalsRow } from "@/lib/domain/stats";

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/statistiche">): Promise<Metadata> {
  const { stagione } = await params;
  return { title: `Statistiche ${stagione}`, description: `Leader e statistiche dei giocatori Bolo Sgreeners nella stagione ${stagione}.` };
}

async function Stats({ params }: { params: Promise<{ stagione: string }> }) {
  const season = await resolveSeason(params);
  const [stats, defs] = await Promise.all([getSeasonStats(season.id), getStatDefinitions()]);
  const matchRows = stats.seasonTotals.filter((t) => t.basis === "match_data");
  const aggregateRows = stats.seasonTotals.filter((t) => t.basis === "historical_aggregate");
  if (matchRows.length === 0 && aggregateRows.length === 0) {
    return <EmptyState title="Statistiche non disponibili">Per questa stagione non ci sono ancora statistiche dei giocatori.</EmptyState>;
  }
  return (
    <div className="space-y-4">
      {aggregateRows.length > 0 && (
        <Notice>
          Questa stagione include anche totali storici senza dettaglio partita: sono conteggiati nelle carriere ma non in queste
          classifiche.
        </Notice>
      )}
      <StatsExplorer
        defs={defs}
        seasonRows={matchRows as TotalsRow[]}
        competitionRows={stats.competitionTotals as (TotalsRow & { competition_id: string | null })[]}
        competitions={season.competitions.filter((c) => stats.competitionTotals.some((t) => t.competition_id === c.id)).map((c) => ({ id: c.id, name: c.name }))}
        players={stats.players}
      />
    </div>
  );
}

export default function StatsPage(props: PageProps<"/stagioni/[stagione]/statistiche">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <Stats params={props.params} />
    </Suspense>
  );
}
