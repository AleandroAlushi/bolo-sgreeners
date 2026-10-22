import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { MatchRow } from "@/components/match";
import { Leaderboard } from "@/components/stats";
import { EmptyState, MoreLink, SectionTitle, StatCard } from "@/components/ui";
import { getSeasonMatches } from "@/lib/data/matches";
import { resolveSeason } from "@/lib/data/params";
import { getSeason } from "@/lib/data/seasons";
import { getSeasonStats, getStatDefinitions } from "@/lib/data/stats";
import { formatNumber } from "@/lib/domain/format";
import type { TotalsRow } from "@/lib/domain/stats";

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]">): Promise<Metadata> {
  const { stagione } = await params;
  const season = await getSeason(stagione);
  return season
    ? { title: `Stagione ${season.slug}`, description: `Bolo Sgreeners ${season.slug}: record ${season.wins}-${season.losses}, risultati, classifiche e statistiche.` }
    : { title: "Stagione non trovata" };
}

async function Overview({ params }: { params: Promise<{ stagione: string }> }) {
  const season = await resolveSeason(params);
  const [matches, stats, defs] = await Promise.all([getSeasonMatches(season.id), getSeasonStats(season.id), getStatDefinitions()]);
  const base = `/stagioni/${season.slug}`;
  if (season.competitions.length === 0 && matches.length === 0) {
    return (
      <EmptyState title="Stagione senza dati">
        {season.notes ?? "Calendario, risultati e statistiche di questa stagione non sono ancora stati importati."}
      </EmptyState>
    );
  }
  const recent = matches.filter((m) => m.involves_own_team && m.own_result).slice(-5).reverse();
  const rows = stats.seasonTotals.filter((t) => t.basis === "match_data") as TotalsRow[];
  const leaderDefs = ["ppg", "rpg", "apg", "fg3m"].map((k) => defs.find((d) => d.key === k)).filter((d) => d !== undefined);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Record" value={`${season.wins}-${season.losses}`} hint={`${season.played} partite giocate`} accent="primary" />
        <StatCard label="Punti fatti" value={season.pointsFor} hint={`${formatNumber(season.played ? season.pointsFor / season.played : null, 1)} a partita`} />
        <StatCard label="Punti subiti" value={season.pointsAgainst} hint={`${formatNumber(season.played ? season.pointsAgainst / season.played : null, 1)} a partita`} />
        <StatCard
          label="Differenza"
          value={season.pointsFor - season.pointsAgainst > 0 ? `+${season.pointsFor - season.pointsAgainst}` : season.pointsFor - season.pointsAgainst}
          accent="secondary"
        />
      </div>

      <section>
        <SectionTitle eyebrow="Fasi">Il cammino</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {season.competitions.map((c) => {
            const r = season.records.find((x) => x.competition_id === c.id);
            return (
              <div key={c.id} className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.kind === "regular_season" ? "Regular season" : c.kind === "playoff" ? "Playoff" : c.kind === "poule" ? "Poule" : c.kind}</p>
                <p className="display text-xl font-bold italic">{c.name}</p>
                <p className="mt-2 text-sm text-muted">
                  <span className="display text-2xl font-bold not-italic text-text">{r ? `${r.wins}-${r.losses}` : "–"}</span>
                  {r && r.played ? ` · ${r.points_for}-${r.points_against}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <SectionTitle eyebrow="Risultati" action={<MoreLink href={`${base}/calendario`}>Calendario completo</MoreLink>}>
            Ultime partite
          </SectionTitle>
          <div className="card divide-y divide-border/60 p-1">
            {recent.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {rows.length > 0 && leaderDefs.length > 0 && (
        <section>
          <SectionTitle eyebrow="Leader" action={<MoreLink href={`${base}/statistiche`}>Statistiche</MoreLink>}>
            I migliori
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {leaderDefs.map((d) => (
              <Leaderboard key={d.key} def={d} rows={rows} players={stats.players} limit={3} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function SeasonPage(props: PageProps<"/stagioni/[stagione]">) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Overview params={props.params} />
    </Suspense>
  );
}
