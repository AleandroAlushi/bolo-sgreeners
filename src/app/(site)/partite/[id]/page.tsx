import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminGraphicsLinks } from "@/components/admin-graphics";
import { IconCalendar, IconClock, IconPin } from "@/components/icons";
import { MatchActions } from "@/components/match-actions";
import { toCalendarMatch } from "@/lib/calendar";
import { googleCalendarUrl, mapLinks } from "@/lib/domain/ics";
import { LoadingBlock } from "@/components/loading";
import { PeriodScores, ResultBadge, TeamBadge, matchSubtitle, statusLabel } from "@/components/match";
import { PlayerAvatar } from "@/components/player";
import { BoxScore, TeamComparison } from "@/components/stats";
import { Badge, Card, Notice, SectionTitle, cx } from "@/components/ui";
import { getAllMatchIds, getMatchDetail, type PlayerGameLine } from "@/lib/data/matches";
import { formatDate, formatTime } from "@/lib/domain/format";

export async function generateStaticParams() {
  const ids = await getAllMatchIds();
  return ids.length ? ids.map((id) => ({ id })) : [{ id: "nessuna" }];
}

export async function generateMetadata({ params }: PageProps<"/partite/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getMatchDetail(id);
  if (!detail) return { title: "Partita non trovata" };
  const m = detail.match;
  const score = m.home_score !== null ? ` ${m.home_score}-${m.away_score}` : "";
  const title = `${m.home_team_name}${score} ${m.away_team_name}`.replace(`${m.home_team_name} ${m.away_team_name}`, `${m.home_team_name} vs ${m.away_team_name}`);
  const description = `${matchSubtitle(m)} · ${formatDate(m.match_date, "long")}${m.venue_name ? ` · ${m.venue_name}` : ""}`;
  return { title, description, openGraph: { title: `${title} · Bolo Sgreeners`, description } };
}

function Leaders({ lines }: { lines: PlayerGameLine[] }) {
  const cats = [
    { key: "points" as const, label: "Punti" },
    { key: "reb" as const, label: "Rimbalzi" },
    { key: "ast" as const, label: "Assist" },
    { key: "stl" as const, label: "Recuperi" },
  ];
  const items = cats
    .map((c) => {
      const best = lines.filter((l) => l.participation === "played" && l.player_id && (l[c.key] ?? 0) > 0).sort((a, b) => (b[c.key] ?? 0) - (a[c.key] ?? 0))[0];
      return best ? { ...c, line: best } : null;
    })
    .filter((x) => x !== null);
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <Link key={it.key} href={`/giocatori/${it.line.player_slug}`} className="card flex items-center gap-3 p-3 hover:border-primary/40">
          <PlayerAvatar name={it.line.player_name ?? ""} jersey={it.line.jersey_number} size={40} />
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">{it.label}</p>
            <p className="display text-2xl leading-none text-primary">{it.line[it.key]}</p>
            <p className="truncate text-xs">{it.line.player_name}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function MatchContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMatchDetail(id);
  if (!detail) notFound();
  const { match: m, periods, playerLines, teamStats, sources, mvpPlayerId } = detail;
  const played = m.status === "played" || m.status === "forfeit";
  const ownTeamId = m.home_is_own ? m.home_team_id : m.away_is_own ? m.away_team_id : null;
  const ownLines = playerLines.filter((l) => l.team_id === ownTeamId);
  const mvp = mvpPlayerId ? (ownLines.find((l) => l.player_id === mvpPlayerId) ?? null) : null;
  const ownStats = teamStats.find((t) => t.team_id === ownTeamId) ?? null;
  const oppStats = teamStats.find((t) => t.team_id !== ownTeamId) ?? null;
  const winnerHome = played && (m.home_score ?? 0) > (m.away_score ?? 0);
  const sides = [
    { name: m.home_team_name!, slug: m.home_team_slug, own: m.home_is_own, logo: m.home_team_logo, score: m.home_score, win: winnerHome, label: "Casa" },
    { name: m.away_team_name!, slug: m.away_team_slug, own: m.away_is_own, logo: m.away_team_logo, score: m.away_score, win: played && !winnerHome, label: "Ospite" },
  ];
  const sourceLabel = (sid: string | null | undefined) => sources.find((s) => s.id === sid)?.label;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/stagioni/${m.season_slug}/calendario`} className="text-sm text-muted hover:text-text">
          ← Calendario {m.season_slug}
        </Link>
      </div>

      <section className="glow-panel rounded-2xl border border-border">
        <div className="p-5 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-center">
            <Badge tone="secondary">{matchSubtitle(m)}</Badge>
            <Badge tone={played ? "neutral" : "primary"}>{statusLabel(m.status)}</Badge>
            {m.own_result && <ResultBadge result={m.own_result} />}
            {m.verification === "to_verify" && (
              <Badge tone="warning" title="L'avversario è stato dedotto dal soprannome usato nel box score">
                Avversario da verificare
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {sides.map((s, i) => (
              <div key={i} className={cx("flex flex-col items-center gap-2 text-center", i === 1 && "col-start-3")}>
                <TeamBadge name={s.name} slug={s.slug} own={s.own} logo={s.logo} size={64} />
                <p className={cx("text-sm font-semibold leading-tight sm:text-base", s.own && "text-primary")}>{s.name}</p>
                {m.home_away_confirmed && <p className="text-[0.65rem] uppercase tracking-wide text-muted">{s.label}</p>}
              </div>
            ))}
            <div className="col-start-2 row-start-1 text-center">
              {played ? (
                <>
                  <p className="display whitespace-nowrap text-7xl leading-[0.85] tabular-nums sm:text-9xl">
                    <span className={sides[0].win ? "" : "text-text/45"}>{m.home_score}</span>
                    <span className="mx-1.5 text-text/30">–</span>
                    <span className={sides[1].win ? "" : "text-text/45"}>{m.away_score}</span>
                  </p>
                  <p className="accent-serif mt-1 text-xl text-text/85 sm:text-2xl">Final</p>
                </>
              ) : (
                <p className="accent-serif text-4xl text-text/80">vs</p>
              )}
              {(m.periods_recorded ?? 0) > 4 && <p className="text-xs text-accent">dopo supplementari</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-text/75">
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar size={15} /> {formatDate(m.match_date, "long")}
            </span>
            {m.start_time && (
              <span className="inline-flex items-center gap-1.5">
                <IconClock size={15} /> {formatTime(m.start_time)}
              </span>
            )}
            {m.venue_name && (
              <span className="inline-flex items-center gap-1.5">
                <IconPin size={15} /> {m.venue_name}
                {m.venue_address && <span className="hidden sm:inline">· {m.venue_address}</span>}
              </span>
            )}
          </div>
          {m.venue_address && <p className="mt-1 text-center text-xs text-muted sm:hidden">{m.venue_address}</p>}
        </div>
      </section>
      {/* fuori dal riquadro: i menu a tendina non vengono tagliati */}
      <MatchActions
        className="-mt-4 justify-center"
        directions={mapLinks(m.venue_name, m.venue_address)}
        calendar={!played && m.match_date ? { ics: `/ics/partita/${m.id}`, google: googleCalendarUrl(toCalendarMatch(m)) } : null}
      />

      {m.notes && <Notice>{m.notes}</Notice>}

      {mvp && (
        <Link href={`/giocatori/${mvp.player_slug}`} className="glow-panel flex items-center gap-4 rounded-2xl border border-border p-4 hover:border-gold/60 sm:p-5">
          <span className="accent-serif text-gold-gradient text-5xl leading-none">MVP</span>
          <span className="min-w-0 flex-1">
            <span className="display block truncate text-3xl leading-none">{mvp.player_name}</span>
            <span className="text-sm text-text/75">
              #{mvp.jersey_number} · {[mvp.points !== null && `${mvp.points} punti`, mvp.reb !== null && `${mvp.reb} rimbalzi`, mvp.ast !== null && `${mvp.ast} assist`].filter(Boolean).join(" · ")}
            </span>
          </span>
        </Link>
      )}

      {periods.length > 0 && (
        <section>
          <SectionTitle>Parziali</SectionTitle>
          <Card className="p-1">
            <PeriodScores match={m} periods={periods} />
          </Card>
        </section>
      )}

      {ownLines.length > 0 && (
        <>
          <section>
            <SectionTitle>Leader della partita</SectionTitle>
            <Leaders lines={ownLines} />
          </section>
          <section>
            <SectionTitle eyebrow="Bolo Sgreeners">Box score</SectionTitle>
            <Card className="p-1 sm:p-2">
              <BoxScore lines={ownLines} teamTotals={ownStats} />
            </Card>
          </section>
        </>
      )}

      {ownStats && oppStats && (
        <section>
          <SectionTitle>Statistiche di squadra</SectionTitle>
          <Card className="p-4 sm:p-6">
            <TeamComparison own={ownStats} opponent={oppStats} ownName="Sgreeners" opponentName={m.opponent_name ?? "Avversari"} />
          </Card>
        </section>
      )}

      {!played && m.status === "scheduled" && (
        <Notice>Partita in programma: risultato e statistiche saranno disponibili dopo l&apos;import del box score.</Notice>
      )}
      {played && ownLines.length === 0 && m.involves_own_team && (
        <Notice>Per questa partita è disponibile solo il risultato: il box score non è in archivio.</Notice>
      )}

      {m.involves_own_team && (
        <Suspense fallback={null}>
          <AdminGraphicsLinks
            date={m.match_date}
            links={[
              ...(played
                ? [
                    { href: `/grafiche/partita/${m.id}`, label: "Final Score", file: "final-score" },
                    ...(playerLines.some((l) => l.is_own_team && l.participation === "played")
                      ? [{ href: `/grafiche/tabellino/${m.id}`, label: "Tabellino", file: "tabellino" }]
                      : []),
                  ]
                : [
                    { href: `/grafiche/presentazione/${m.id}`, label: "Game day", file: "game-day" },
                    { href: `/grafiche/tifosi/${m.id}`, label: "Chiamata ai tifosi", file: "tifosi" },
                  ]),
              ...(mvp ? [{ href: `/grafiche/mvp/${m.id}`, label: "MVP", file: "mvp" }] : []),
            ]}
          />
        </Suspense>
      )}

      <footer className="border-t border-border pt-4 text-xs text-muted">
        <p className="font-semibold uppercase tracking-wide">Fonti</p>
        <ul className="mt-1 space-y-0.5">
          {sourceLabel(m.result_source_id) && <li>Risultato: {sourceLabel(m.result_source_id)}</li>}
          {sourceLabel(m.schedule_source_id) && <li>Calendario: {sourceLabel(m.schedule_source_id)}</li>}
          {ownLines[0] && sourceLabel(ownLines[0].source_id) && <li>Statistiche: {sourceLabel(ownLines[0].source_id)}</li>}
          {periods[0] && sourceLabel(periods[0].source_id) && <li>Parziali: {sourceLabel(periods[0].source_id)}</li>}
        </ul>
      </footer>
    </div>
  );
}

export default function MatchPage(props: PageProps<"/partite/[id]">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <MatchContent params={props.params} />
    </Suspense>
  );
}
