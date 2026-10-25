import Image from "next/image";
import Link from "next/link";
import { IconArchive, IconCalendar, IconChart, IconTrophy, IconUsers } from "@/components/icons";
import { MatchCard, MatchRow, ResultBadge } from "@/components/match";
import { Leaderboard } from "@/components/stats";
import { EmptyState, MoreLink, Notice, SectionTitle, StatCard } from "@/components/ui";
import { dbReady, getToday } from "@/lib/data/core";
import { getSeasonMatches, lastAndNext } from "@/lib/data/matches";
import { getFeaturedSeason, getSeasons } from "@/lib/data/seasons";
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
  const { last: lastThisSeason, next } = lastAndNext(matches, today);
  // a inizio stagione lo storico mostra la stagione precedente
  const previous = lastThisSeason ? null : (await getSeasons()).find((s) => s.id !== featured.id && s.played > 0);
  const historyMatches = previous ? await getSeasonMatches(previous.id) : matches;
  const last = lastThisSeason ?? (previous ? lastAndNext(historyMatches, today).last : null);
  const historySlug = previous?.slug ?? featured.slug;
  // forma: ultime cinque giocate, dalla più vecchia alla più recente
  const form = historyMatches
    .filter((m) => m.involves_own_team && m.own_result)
    .sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? ""))
    .slice(-5);
  const leaders = ["ppg", "rpg", "apg"].map((k) => defs.find((d) => d.key === k)).filter((d) => d !== undefined);
  const matchRows = stats.seasonTotals.filter((t) => t.basis === "match_data") as TotalsRow[];
  const ownStanding = standings
    .filter((s) => s.competition.kind === "regular_season")
    .flatMap((s) => s.rows.filter((r) => r.is_own_team).map((r) => ({ row: r, comp: s.competition, total: s.rows.length })))
    .at(0);
  const base = `/stagioni/${featured.slug}`;

  return (
    <div className="space-y-10">
      <section className="glow-panel rounded-3xl border border-border px-5 pb-6 pt-7 sm:px-8 sm:pt-9">
        <Image
          src="/brand/logo.png"
          alt="Logo Bolo Sgreeners"
          width={640}
          height={475}
          priority
          className="pointer-events-none absolute right-4 top-4 w-24 drop-shadow-[0_0_24px_rgba(0,0,0,0.7)] sm:right-8 sm:top-8 sm:w-72"
        />
        <p className="eyebrow text-text/80">Basket CSI · Bologna</p>
        <h1 className="display mt-2 text-7xl leading-[0.82] sm:text-[7.5rem]">
          Bolo
          <br />
          <span className="text-gradient">Sgreeners</span>
        </h1>
        <p className="accent-serif mt-3 text-2xl text-text/90 sm:text-3xl">{featured.label}</p>
        {featured.competitions.length > 0 && (
          <p className="eyebrow mt-1 text-[0.62rem] text-text/70">{featured.competitions.map((c) => c.name).join(" · ")}</p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard className="border-white/10 bg-black/45 backdrop-blur-sm" label="Record" value={`${featured.wins}-${featured.losses}`} hint={`${featured.played} partite`} accent="primary" />
          <StatCard
            className="border-white/10 bg-black/45 backdrop-blur-sm"
            label="Punti fatti"
            value={formatNumber(featured.played ? featured.pointsFor / featured.played : null, 1)}
            hint="media a partita"
          />
          <StatCard
            className="border-white/10 bg-black/45 backdrop-blur-sm"
            label="Punti subiti"
            value={formatNumber(featured.played ? featured.pointsAgainst / featured.played : null, 1)}
            hint="media a partita"
          />
          {ownStanding ? (
            <StatCard className="border-white/10 bg-black/45 backdrop-blur-sm" label="Classifica" value={`${ownStanding.row.position}°`} hint={`${ownStanding.comp.name} · ${ownStanding.total} squadre`} accent="secondary" />
          ) : (
            <StatCard
              className="border-white/10 bg-black/45 backdrop-blur-sm"
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
          <SectionTitle eyebrow="Partite">Prossima partita</SectionTitle>
          <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
            {/* indicazioni e "aggiungi al calendario" sono nella pagina della partita */}
            {next ? (
              <MatchCard match={next} label={featured.slug} />
            ) : (
              <div className="card flex items-center justify-center p-6 text-center text-sm text-muted">Nessuna partita in programma.</div>
            )}
            <div className="card flex flex-col p-4 sm:p-5">
              <p className="eyebrow text-secondary">Match history · {historySlug}</p>
              <p className="display mt-0.5 text-2xl leading-none">Ultima giocata</p>
              <div className="-mx-2 mt-3">{last ? <MatchRow match={last} /> : <p className="px-2 text-sm text-muted">Nessuna partita giocata.</p>}</div>
              {form.length > 1 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted">Forma</span>
                  <span className="flex gap-1">
                    {form.map((m) => (
                      <ResultBadge key={m.id} result={m.own_result} />
                    ))}
                  </span>
                </div>
              )}
              <div className="min-h-4 flex-1" />
              <Link
                href={`/stagioni/${historySlug}/calendario`}
                className="inline-flex items-center justify-center gap-1 self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-opacity hover:opacity-90"
              >
                Mostra tutte le partite →
              </Link>
            </div>
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
            { href: `${base}/squadra`, label: "Squadra", icon: <IconUsers size={22} /> },
            { href: `${base}/calendario`, label: "Calendario", icon: <IconCalendar size={22} /> },
            { href: `${base}/classifica`, label: "Classifica", icon: <IconTrophy size={22} /> },
            { href: `${base}/statistiche`, label: "Statistiche", icon: <IconChart size={22} /> },
            { href: "/stagioni", label: "Archivio stagioni", icon: <IconArchive size={22} /> },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="card flex flex-col gap-3 p-4 transition-colors hover:border-primary/40 hover:text-primary">
              <span className="text-secondary">{l.icon}</span>
              <span className="display text-2xl leading-none">{l.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
