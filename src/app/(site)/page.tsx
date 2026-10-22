import Link from "next/link";
import { IconArchive, IconCalendar, IconChart, IconTrophy, IconUsers } from "@/components/icons";
import { MatchCard } from "@/components/match";
import { Leaderboard } from "@/components/stats";
import { EmptyState, MoreLink, Notice, SectionTitle, StatCard } from "@/components/ui";
import { dbReady, getToday } from "@/lib/data/core";
import { getSeasonMatches, lastAndNext } from "@/lib/data/matches";
import { getFeaturedSeason } from "@/lib/data/seasons";
import { getSeasonStandings } from "@/lib/data/standings";
import { getSeasonStats, getStatDefinitions } from "@/lib/data/stats";
import { formatNumber } from "@/lib/domain/format";
import type { TotalsRow } from "@/lib/domain/stats";

export default async function HomePage() {
  if (!dbReady()) {
    return (
      <EmptyState title="Database non configurato">
        Imposta <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (vedi README) per vedere i
        dati dei Bolo Sgreeners.
      </EmptyState>
    );
  }
  const { featured, current } = await getFeaturedSeason();
  if (!featured) return <EmptyState title="Nessuna stagione in archivio">Le stagioni appariranno qui dopo il primo import.</EmptyState>;

  const [matches, stats, defs, standings, today] = await Promise.all([
    getSeasonMatches(featured.id),
    getSeasonStats(featured.id),
    getStatDefinitions(),
    getSeasonStandings(featured.id),
    getToday(),
  ]);
  const { last, next } = lastAndNext(matches, today);
  const leaders = ["ppg", "rpg", "apg"].map((k) => defs.find((d) => d.key === k)).filter((d) => d !== undefined);
  const matchRows = stats.seasonTotals.filter((t) => t.basis === "match_data") as TotalsRow[];
  const ownStanding = standings
    .filter((s) => s.competition.kind === "regular_season")
    .flatMap((s) => s.rows.filter((r) => r.is_own_team).map((r) => ({ row: r, comp: s.competition, total: s.rows.length })))
    .at(0);
  const base = `/stagioni/${featured.slug}`;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface px-5 pb-6 pt-7 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-24 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">Basket CSI · Bologna</p>
        <h1 className="display mt-1 text-5xl font-extrabold italic leading-[0.9] sm:text-7xl">
          Bolo <span className="text-primary">Sgreeners</span>
        </h1>
        <div className="neon-line mt-4 h-1 w-32 rounded-full" />
        <p className="mt-4 max-w-xl text-muted">
          {featured.label}
          {featured.competitions.length > 0 && <> · {featured.competitions.map((c) => c.name).join(", ")}</>}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Record" value={`${featured.wins}-${featured.losses}`} hint={`${featured.played} partite`} accent="primary" />
          <StatCard
            label="Punti fatti"
            value={formatNumber(featured.played ? featured.pointsFor / featured.played : null, 1)}
            hint="media a partita"
          />
          <StatCard
            label="Punti subiti"
            value={formatNumber(featured.played ? featured.pointsAgainst / featured.played : null, 1)}
            hint="media a partita"
          />
          {ownStanding ? (
            <StatCard label="Classifica" value={`${ownStanding.row.position}°`} hint={`${ownStanding.comp.name} · ${ownStanding.total} squadre`} accent="secondary" />
          ) : (
            <StatCard
              label="Diff. punti"
              value={featured.pointsFor - featured.pointsAgainst > 0 ? `+${featured.pointsFor - featured.pointsAgainst}` : featured.pointsFor - featured.pointsAgainst}
              hint="totale stagione"
              accent="secondary"
            />
          )}
        </div>
      </section>

      {current && current.id !== featured.id && (
        <Notice>
          <strong>{current.label} in corso:</strong> calendario e risultati non sono ancora stati importati. Qui sotto trovi
          l&apos;ultima stagione disponibile.
        </Notice>
      )}

      {(last || next) && (
        <section>
          <SectionTitle eyebrow="Partite" action={<MoreLink href={`${base}/calendario`}>Calendario</MoreLink>}>
            Ultima e prossima
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {last && <MatchCard match={last} label="Ultima partita" />}
            {next ? (
              <MatchCard match={next} label="Prossima partita" />
            ) : (
              <div className="card flex items-center justify-center p-6 text-center text-sm text-muted">Nessuna partita in programma.</div>
            )}
          </div>
        </section>
      )}

      {leaders.length > 0 && matchRows.length > 0 && (
        <section>
          <SectionTitle eyebrow={featured.slug} action={<MoreLink href={`${base}/statistiche`}>Tutte le statistiche</MoreLink>}>
            Leader della stagione
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            {leaders.map((def) => (
              <Leaderboard key={def.key} def={def} rows={matchRows} players={stats.players} limit={3} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle eyebrow="Esplora">Tutto sugli Sgreeners</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { href: `${base}/roster`, label: "Roster", icon: <IconUsers size={22} /> },
            { href: `${base}/calendario`, label: "Calendario", icon: <IconCalendar size={22} /> },
            { href: `${base}/classifica`, label: "Classifica", icon: <IconTrophy size={22} /> },
            { href: `${base}/statistiche`, label: "Statistiche", icon: <IconChart size={22} /> },
            { href: "/stagioni", label: "Archivio stagioni", icon: <IconArchive size={22} /> },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="card flex flex-col gap-3 p-4 transition-colors hover:border-primary/40 hover:text-primary">
              <span className="text-secondary">{l.icon}</span>
              <span className="display text-lg font-bold italic leading-none">{l.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
