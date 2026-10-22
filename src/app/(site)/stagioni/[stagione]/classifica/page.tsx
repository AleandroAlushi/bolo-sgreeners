import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { MatchRow } from "@/components/match";
import { StandingsTable } from "@/components/standings";
import { EmptyState, Notice, SectionTitle } from "@/components/ui";
import { getSeasonMatches } from "@/lib/data/matches";
import { resolveSeason } from "@/lib/data/params";
import { getSeasonStandings } from "@/lib/data/standings";

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/classifica">): Promise<Metadata> {
  const { stagione } = await params;
  return { title: `Classifica ${stagione}`, description: `Classifiche della stagione ${stagione} dei Bolo Sgreeners.` };
}

async function Standings({ params }: { params: Promise<{ stagione: string }> }) {
  const season = await resolveSeason(params);
  const [standings, matches] = await Promise.all([getSeasonStandings(season.id), getSeasonMatches(season.id)]);
  if (standings.length === 0) return <EmptyState title="Nessuna classifica">Per questa stagione non ci sono ancora competizioni.</EmptyState>;
  return (
    <div className="space-y-10">
      {standings.map((s) => {
        const record = season.records.find((r) => r.competition_id === s.competition.id);
        return (
          <section key={s.competition.id}>
            <SectionTitle eyebrow={s.competition.kind === "playoff" ? "Playoff" : s.competition.kind === "poule" ? "Poule" : "Regular season"}>
              {s.competition.name}
            </SectionTitle>
            {s.mode === "computed" || s.mode === "official" ? (
              <StandingsTable data={s} />
            ) : s.mode === "own-only" && s.competition.kind === "playoff" ? (
              <div className="card divide-y divide-border/60 p-1">
                {matches
                  .filter((m) => m.competition_id === s.competition.id)
                  .map((m) => (
                    <MatchRow key={m.id} match={m} showPhase={false} />
                  ))}
              </div>
            ) : s.mode === "own-only" ? (
              <div className="space-y-3">
                <Notice>
                  Classifica non ancora disponibile: nel database ci sono solo le partite dei Bolo Sgreeners
                  {record ? ` (record ${record.wins}-${record.losses}, ${record.points_for}-${record.points_against})` : ""}. Per
                  vederla serve importare la classifica ufficiale CSI o il calendario completo.
                </Notice>
              </div>
            ) : (
              <EmptyState title="Nessun dato">Non ci sono ancora partite per questa competizione.</EmptyState>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function StandingsPage(props: PageProps<"/stagioni/[stagione]/classifica">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <Standings params={props.params} />
    </Suspense>
  );
}
