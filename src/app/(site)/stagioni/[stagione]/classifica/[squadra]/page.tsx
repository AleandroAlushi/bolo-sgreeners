import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { MatchRow, TeamBadge } from "@/components/match";
import { Card, EmptyState, SectionTitle, StatCard, cx } from "@/components/ui";
import { resolveSeason } from "@/lib/data/params";
import { getSeasonStandings } from "@/lib/data/standings";
import { getSeasonTeamSlugs, getTeamSeason, type TeamGame } from "@/lib/data/teams";
import { getSeasons } from "@/lib/data/seasons";
import { formatDate, formatNumber } from "@/lib/domain/format";

// in build le squadre di ogni stagione; una squadra nuova si genera alla prima visita
export async function generateStaticParams({ params }: { params: { stagione: string } }) {
  const season = (await getSeasons()).find((s) => s.slug === params.stagione);
  const slugs = season ? await getSeasonTeamSlugs(season.id) : [];
  return slugs.length ? slugs.map((squadra) => ({ squadra })) : [{ squadra: "nessuna" }];
}

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/classifica/[squadra]">): Promise<Metadata> {
  const { stagione, squadra } = await params;
  const season = (await getSeasons()).find((s) => s.slug === stagione);
  const data = season ? await getTeamSeason(season.id, squadra) : null;
  if (!data) return { title: "Squadra non trovata" };
  return { title: `${data.team.name} ${stagione}`, description: `Risultati, record e forma di ${data.team.name} nella stagione ${stagione}.` };
}

const played = (g: TeamGame) => g.scoreFor !== null && g.scoreAgainst !== null;
const won = (g: TeamGame) => played(g) && g.scoreFor! > g.scoreAgainst!;
const record = (games: TeamGame[]) => `${games.filter(won).length}-${games.filter((g) => played(g) && !won(g)).length}`;

/** Serie in corso: "3 vittorie di fila" / "2 sconfitte di fila". */
function streak(games: TeamGame[]) {
  const done = games.filter(played);
  const last = done.at(-1);
  if (!last) return null;
  let n = 0;
  for (let i = done.length - 1; i >= 0 && won(done[i]) === won(last); i--) n++;
  return { win: won(last), n };
}

async function Team({ params }: { params: Promise<{ stagione: string; squadra: string }> }) {
  const { squadra } = await params;
  const season = await resolveSeason(params);
  const [data, standings] = await Promise.all([getTeamSeason(season.id, squadra), getSeasonStandings(season.id)]);
  if (!data) notFound();
  const { team, games, vsOwn, slugs } = data;
  const done = games.filter(played);
  const n = done.length;
  const pf = done.reduce((s, g) => s + g.scoreFor!, 0);
  const pa = done.reduce((s, g) => s + g.scoreAgainst!, 0);
  const home = done.filter((g) => g.home);
  const away = done.filter((g) => !g.home);
  const s = streak(games);
  const form = done.slice(-5);
  // posizione nelle classifiche della stagione
  const places = standings.flatMap((c) => {
    const row = c.rows.find((r) => r.team_id === team.id);
    return row ? [{ competition: c.competition.name, position: row.position, points: row.points, total: c.rows.length }] : [];
  });
  // parziali medi per quarto (solo partite con i parziali)
  const withPeriods = done.filter((g) => g.periodsFor?.length && g.periodsAgainst?.length);
  const quarters = [0, 1, 2, 3]
    .map((q) => {
      const gs = withPeriods.filter((g) => g.periodsFor![q] !== undefined && g.periodsAgainst![q] !== undefined);
      return gs.length ? { q, f: gs.reduce((a, g) => a + g.periodsFor![q], 0) / gs.length, a: gs.reduce((a, g) => a + g.periodsAgainst![q], 0) / gs.length } : null;
    })
    .filter((x): x is { q: number; f: number; a: number } => x !== null);
  const ownHref = `/stagioni/${season.slug}/squadra`;
  const teamHref = (id: string | null, isOwn: boolean) => (isOwn ? ownHref : id && slugs[id] ? `/stagioni/${season.slug}/classifica/${slugs[id]}` : null);

  return (
    <div className="space-y-10">
      <div>
        <Link href={`/stagioni/${season.slug}/classifica`} className="text-sm text-muted hover:text-text">
          ← Classifica {season.slug}
        </Link>
        <header className="glow-panel mt-3 flex items-center gap-4 rounded-3xl border border-border p-5 sm:p-7">
          <TeamBadge name={team.name} slug={team.slug} logo={team.logo_path} own={team.is_own_team} size={84} />
          <div className="min-w-0">
            <p className="eyebrow text-text/80">Avversari · {season.slug}</p>
            <h1 className="display text-4xl leading-[0.9] sm:text-6xl">{team.name}</h1>
            {places.map((p) => (
              <p key={p.competition} className="mt-1 text-sm text-text/80">
                <span className="font-semibold text-primary">{p.position}°</span> su {p.total} in {p.competition} · {formatNumber(p.points)} punti
              </p>
            ))}
          </div>
        </header>
      </div>

      {n > 0 ? (
        <section>
          <SectionTitle eyebrow={`${n} partite giocate`}>I numeri</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Record" value={record(done)} accent="primary" hint={s ? `${s.n} ${s.win ? (s.n === 1 ? "vittoria" : "vittorie") : s.n === 1 ? "sconfitta" : "sconfitte"} di fila` : undefined} />
            <StatCard label="Punti fatti" value={formatNumber(pf / n, 1)} hint={`${pf} in totale`} />
            <StatCard label="Punti subiti" value={formatNumber(pa / n, 1)} hint={`${pa} in totale`} />
            <StatCard label="Differenza" value={`${pf >= pa ? "+" : ""}${formatNumber((pf - pa) / n, 1)}`} accent="secondary" hint="a partita" />
            <StatCard label="In casa" value={record(home)} hint={home.length ? `${formatNumber(home.reduce((a, g) => a + g.scoreFor!, 0) / home.length, 1)} punti a partita` : undefined} />
            <StatCard label="In trasferta" value={record(away)} hint={away.length ? `${formatNumber(away.reduce((a, g) => a + g.scoreFor!, 0) / away.length, 1)} punti a partita` : undefined} />
          </div>
        </section>
      ) : (
        <EmptyState title="Nessuna partita giocata">Questa squadra non ha ancora risultati in questa stagione.</EmptyState>
      )}

      {form.length > 0 && (
        <section>
          <SectionTitle eyebrow="Ultime partite">Stato di forma</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {form.map((g) => (
              <span
                key={g.id}
                title={`${g.home ? "vs" : "@"} ${g.opponentName} ${g.scoreFor}-${g.scoreAgainst}`}
                className={cx("flex flex-col items-center rounded-xl px-3 py-2 ring-1", won(g) ? "bg-win/15 text-win ring-win/40" : "bg-loss/15 text-loss ring-loss/40")}
              >
                <span className="display text-2xl leading-none">{won(g) ? "V" : "S"}</span>
                <span className="mt-0.5 text-[0.65rem] tabular-nums text-text/80">
                  {g.scoreFor}-{g.scoreAgainst}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {quarters.length === 4 && (
        <section>
          <SectionTitle eyebrow={`media su ${withPeriods.length} partite`}>Quarto per quarto</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {quarters.map((q) => (
              <Card key={q.q} as="div" className="p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{q.q + 1}° quarto</p>
                <p className="display mt-1 text-2xl tabular-nums">
                  {formatNumber(q.f, 1)}
                  <span className="text-muted">–</span>
                  {formatNumber(q.a, 1)}
                </p>
                <p className={cx("text-xs tabular-nums", q.f >= q.a ? "text-win" : "text-loss")}>
                  {q.f >= q.a ? "+" : ""}
                  {formatNumber(q.f - q.a, 1)}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {vsOwn.length > 0 && (
        <section>
          <SectionTitle eyebrow="Con box score">Contro i Bolo Sgreeners</SectionTitle>
          <div className="card divide-y divide-border/60 p-1">
            {vsOwn.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle eyebrow={`${games.length} partite in calendario`}>Risultati</SectionTitle>
        <ul className="card divide-y divide-border/60 p-1">
          {games.map((g) => {
            const href = teamHref(g.opponentId, g.opponentIsOwn);
            return (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-14 shrink-0 text-[0.7rem] leading-tight text-muted">
                  {g.date ? formatDate(g.date, "day-month") : "–"}
                  <span className="block truncate">{g.roundLabel?.replace(" giornata", "")}</span>
                </span>
                <span className="w-5 shrink-0 text-xs text-muted">{g.home ? "vs" : "@"}</span>
                <TeamBadge name={g.opponentName} own={g.opponentIsOwn} logo={g.opponentLogo} size={26} />
                {href ? (
                  <Link href={href} className={cx("min-w-0 flex-1 truncate text-sm font-semibold hover:text-primary", g.opponentIsOwn && "text-primary")}>
                    {g.opponentName}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.opponentName}</span>
                )}
                {played(g) ? (
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="text-sm font-semibold">
                      {g.scoreFor}-{g.scoreAgainst}
                    </span>
                    <span className={cx("grid size-6 place-items-center rounded-full text-[0.65rem] font-bold", won(g) ? "bg-win text-black" : "bg-loss text-white")}>
                      {won(g) ? "V" : "S"}
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted">da giocare</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">Risultati dal Livescore CSI. Le formazioni delle altre squadre non sono pubbliche, quindi qui non ci sono.</p>
      </section>
    </div>
  );
}

export default function TeamPage(props: PageProps<"/stagioni/[stagione]/classifica/[squadra]">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <Team params={props.params} />
    </Suspense>
  );
}
