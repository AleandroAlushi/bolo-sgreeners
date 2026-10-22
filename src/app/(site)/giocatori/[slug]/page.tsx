import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { PlayerAvatar } from "@/components/player";
import { GameLog, TotalsTable } from "@/components/stats";
import { Badge, Card, EmptyState, SectionTitle, StatCard } from "@/components/ui";
import { getPlayerProfile, getPlayers } from "@/lib/data/players";
import { getSeasons } from "@/lib/data/seasons";
import { formatDate, formatNumber } from "@/lib/domain/format";
import type { TotalsRow } from "@/lib/domain/stats";

export async function generateStaticParams() {
  const players = await getPlayers();
  return players.length ? players.map((p) => ({ slug: p.slug })) : [{ slug: "nessuno" }];
}

export async function generateMetadata({ params }: PageProps<"/giocatori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPlayerProfile(slug);
  if (!profile) return { title: "Giocatore non trovato" };
  const { player, career } = profile;
  const fullName = `${player.first_name} ${player.last_name}`;
  const ppg = career?.points_games ? formatNumber((career.points ?? 0) / career.points_games, 1) : null;
  const description = career
    ? `${fullName}${player.nickname ? ` “${player.nickname}”` : ""}: ${career.games} presenze e ${career.points ?? 0} punti${ppg ? ` (${ppg} a partita)` : ""} con i Bolo Sgreeners.`
    : `${fullName}, giocatore dei Bolo Sgreeners.`;
  return { title: fullName, description, openGraph: { title: `${fullName} · Bolo Sgreeners`, description } };
}

const avg = (total: number | null | undefined, games: number | null | undefined) => (total !== null && total !== undefined && games ? total / games : null);

async function Profile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [profile, seasons] = await Promise.all([getPlayerProfile(slug), getSeasons()]);
  if (!profile) notFound();
  const { player, rosters, seasonTotals, competitionTotals, career, gameLog } = profile;
  const fullName = `${player.first_name} ${player.last_name}`;
  const seasonSlug = (id: string | null) => seasons.find((s) => s.id === id)?.slug ?? "?";
  const latestRoster = rosters.at(-1);

  const seasonRows = [...seasonTotals]
    .sort((a, b) => seasonSlug(a.season_id).localeCompare(seasonSlug(b.season_id)))
    .map((t) => ({
      ...(t as TotalsRow),
      label: seasonSlug(t.season_id),
      href: `/stagioni/${seasonSlug(t.season_id)}`,
      sublabel: t.basis === "historical_aggregate" ? "totali storici (senza dettaglio partita)" : `#${rosters.find((r) => r.season_id === t.season_id)?.jersey_number ?? "–"}`,
    }));
  const competitionNames = new Map(seasons.flatMap((s) => s.competitions.map((c) => [c.id, `${s.slug} · ${c.name}`] as const)));
  const competitionRows = [...competitionTotals]
    .sort((a, b) => (competitionNames.get(a.competition_id!) ?? "").localeCompare(competitionNames.get(b.competition_id!) ?? ""))
    .map((t) => ({ ...(t as TotalsRow), label: competitionNames.get(t.competition_id!) ?? "?" }));

  const played = gameLog.filter((l) => l.participation === "played");
  const high = (k: "points" | "reb" | "ast") => {
    const best = played.filter((l) => l[k] !== null).sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0))[0];
    return best ? { value: best[k], line: best } : null;
  };
  const highs = [
    { label: "Punti", h: high("points") },
    { label: "Rimbalzi", h: high("reb") },
    { label: "Assist", h: high("ast") },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <PlayerAvatar name={fullName} photoPath={player.photo_path} jersey={latestRoster?.jersey_number} size={104} />
        <div>
          <p className="text-sm text-muted">{player.first_name}</p>
          <h1 className="display text-5xl font-extrabold italic leading-[0.9]">{player.last_name}</h1>
          {player.nickname && <p className="mt-1 text-lg text-primary">“{player.nickname}”</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rosters.map((r) => (
              <Link key={r.season_slug} href={`/stagioni/${r.season_slug}/roster`}>
                <Badge tone="secondary">
                  {r.season_slug}
                  {r.jersey_number ? ` · #${r.jersey_number}` : ""}
                  {r.role ? ` · ${r.role}` : ""}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </header>

      {career ? (
        <section>
          <SectionTitle eyebrow="Carriera con i Bolo Sgreeners">I numeri</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Presenze" value={career.games ?? 0} hint={`${career.seasons_with_stats} stagioni`} />
            <StatCard label="Punti" value={career.points ?? 0} accent="primary" hint={`${formatNumber(avg(career.points, career.points_games), 1)} a partita`} />
            <StatCard label="Rimbalzi" value={career.reb ?? "–"} hint={`${formatNumber(avg(career.reb, career.reb_games), 1)} a partita`} />
            <StatCard label="Assist" value={career.ast ?? "–"} hint={`${formatNumber(avg(career.ast, career.ast_games), 1)} a partita`} />
            <StatCard label="Recuperi" value={career.stl ?? "–"} hint={`${formatNumber(avg(career.stl, career.stl_games), 1)} a partita`} />
            <StatCard label="Triple" value={career.fg3m ?? "–"} accent="secondary" hint={career.fg3a ? `su ${career.fg3a} tentativi` : undefined} />
          </div>
          {career.includes_historical_aggregates && (
            <p className="mt-2 text-xs text-muted">La carriera include totali storici senza dettaglio partita.</p>
          )}
        </section>
      ) : (
        <EmptyState title="Nessuna statistica">Per questo giocatore non ci sono ancora statistiche registrate.</EmptyState>
      )}

      {seasonRows.length > 0 && (
        <section>
          <SectionTitle eyebrow="Stagione per stagione">Statistiche</SectionTitle>
          <TotalsTable rows={seasonRows} firstHeader="Stagione" totalRow={career ? { ...(career as TotalsRow), label: "Carriera" } : null} />
        </section>
      )}

      {competitionRows.length > 1 && (
        <section>
          <SectionTitle eyebrow="Per fase">Regular season, poule e playoff</SectionTitle>
          <TotalsTable rows={competitionRows} firstHeader="Fase" />
        </section>
      )}

      {played.length > 0 && (
        <section>
          <SectionTitle eyebrow="Record personali">Migliori prestazioni</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {highs.map(({ label, h }) =>
              h ? (
                <Card key={label} as="div" className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label} in una partita</p>
                  <p className="display text-4xl font-extrabold text-primary">{h.value}</p>
                  <Link href={`/partite/${h.line.match_id}`} className="text-xs text-muted hover:text-text">
                    vs {h.line.opponent_name} · {formatDate(h.line.match_date)}
                  </Link>
                </Card>
              ) : null,
            )}
          </div>
        </section>
      )}

      {played.length > 0 && (
        <section>
          <SectionTitle eyebrow={`${played.length} partite`}>Partita per partita</SectionTitle>
          <GameLog lines={gameLog} />
        </section>
      )}
    </div>
  );
}

export default function PlayerPage(props: PageProps<"/giocatori/[slug]">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <Profile params={props.params} />
    </Suspense>
  );
}
