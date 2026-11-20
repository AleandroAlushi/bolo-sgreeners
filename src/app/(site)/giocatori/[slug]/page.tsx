import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { PlayerAvatar } from "@/components/player";
import { PhotoButton, PhotoViewer } from "@/components/photo-viewer";
import { ContextSplits, MvpList, PointsTrend, RecentForm } from "@/components/player-insights";
import { PersonalRecords } from "@/components/records";
import { TeamOnlyBirthday } from "@/components/team-only";
import { GameLog } from "@/components/stats";
import { PlayerTotals } from "@/components/stats-explorer";
import { Badge, EmptyState, SectionTitle, StatCard, cx } from "@/components/ui";
import { getPlayerProfile, getPlayers } from "@/lib/data/players";
import { getFeaturedSeason, getSeasons } from "@/lib/data/seasons";
import { formatNumber } from "@/lib/domain/format";
import { recordScopes, type RecordLine } from "@/lib/domain/records";
import type { TotalsRow } from "@/lib/domain/stats";
import { publicMediaUrl, videoPosterUrl } from "@/lib/media";

// in build solo i giocatori della stagione in evidenza: gli altri si generano alla prima visita
export async function generateStaticParams() {
  const [players, { featured }] = await Promise.all([getPlayers(), getFeaturedSeason()]);
  const current = players.filter((p) => !featured || p.seasons.includes(featured.slug));
  return current.length ? current.map((p) => ({ slug: p.slug })) : [{ slug: "nessuno" }];
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
  const { player, rosters, seasonTotals, competitionTotals, career, gameLog, mvps, staffRoles } = profile;
  const fullName = `${player.first_name} ${player.last_name}`;
  const seasonSlug = (id: string | null) => seasons.find((s) => s.id === id)?.slug ?? "?";
  const latestRoster = rosters.at(-1);
  // figurine delle stagioni (in ordine): il video in loop se c'è, altrimenti la foto; si aprono in grande
  const photos = rosters.filter((r) => r.season_video_path || r.season_photo_path);
  const mediaOf = (r: (typeof rosters)[number]) => (r.season_video_path ? { url: publicMediaUrl(r.season_video_path)!, video: true } : { url: publicMediaUrl(r.season_photo_path)!, video: false });
  // tondino: la foto predefinita del giocatore (la caricatura), altrimenti l'ultima foto di stagione
  const avatarPath = player.photo_path ?? photos.at(-1)?.season_photo_path ?? null;
  const avatarCrop = player.photo_path ? player.avatar_crop : photos.at(-1)?.avatar_crop;
  const viewerPhotos = photos.map((r) => ({ ...mediaOf(r), caption: `${fullName} · ${r.season_slug}` }));
  let avatarIndex = photos.findIndex((r) => r.season_photo_path === avatarPath);
  if (avatarPath && avatarIndex < 0) avatarIndex = viewerPhotos.push({ url: publicMediaUrl(avatarPath)!, video: false, caption: fullName }) - 1;

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
  // stagione più recente con almeno 3 partite con i punti registrati
  const trendSeason = [...new Set(played.filter((l) => l.points !== null).map((l) => l.season_slug!))]
    .sort()
    .reverse()
    .find((season) => played.filter((l) => l.season_slug === season && l.points !== null).length >= 3);
  // career high: di sempre e stagione per stagione
  const records = recordScopes(played.filter((l) => l.match_id && l.season_slug) as RecordLine[]);

  return (
    <div className="space-y-10">
      <PhotoViewer photos={viewerPhotos}>
      <header className="glow-panel rounded-3xl border border-border px-5 pb-6 pt-6 sm:px-8 sm:pt-8">
        {latestRoster?.jersey_number && (
          <span aria-hidden className="display pointer-events-none absolute right-4 top-0 text-[9rem] leading-none text-white/90 drop-shadow-[0_6px_24px_rgba(0,0,0,0.5)] sm:right-8 sm:text-[13rem]">
            {latestRoster.jersey_number}
          </span>
        )}
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end">
          {/* la foto predefinita (la caricatura), altrimenti l'ultima foto di stagione; un tocco la apre in grande */}
          {avatarPath ? (
            <PhotoButton index={avatarIndex} label={`Apri la foto di ${fullName}`} className="shrink-0 self-start cursor-zoom-in">
              <PlayerAvatar name={fullName} photoPath={avatarPath} crop={avatarCrop} size={112} />
            </PhotoButton>
          ) : (
            <PlayerAvatar name={fullName} photoPath={null} size={112} />
          )}
          <div className="min-w-0">
            <p className="eyebrow text-text/80">{player.first_name}</p>
            <h1 className="display text-6xl leading-[0.85] sm:text-8xl">{player.last_name}</h1>
            {player.nickname && <p className="accent-serif mt-2 text-2xl text-text/90">{player.nickname}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {latestRoster?.role && <span className="eyebrow mr-1 text-secondary">{latestRoster.role}</span>}
              {(player.height_cm || player.hand) && (
                <span className="eyebrow mr-1 text-text/80">{[player.height_cm && `${player.height_cm} cm`, player.hand].filter(Boolean).join(" · ")}</span>
              )}
              {latestRoster?.is_captain && <span className="rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-black">Capitano</span>}
              {latestRoster?.is_vice_captain && <span className="rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-black">Vice capitano</span>}
              {mvps.length > 0 && (
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-gold ring-1 ring-gold/50">
                  {mvps.length}× MVP
                </span>
              )}
              <Suspense fallback={null}>
                <TeamOnlyBirthday playerId={player.id} />
              </Suspense>
              {[...new Set(staffRoles.map((r) => r.role))].map((role) => (
                <span key={role} className="rounded-full bg-black/50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-sky ring-1 ring-sky/40">
                  Staff · {role}
                </span>
              ))}
            </div>
          </div>
        </div>
        {rosters.length > 0 && (
          <div className="relative mt-5 border-t border-white/10 pt-4">
            <p className="text-sm text-text/80">
              Sgreener dal <span className="font-semibold text-text">{rosters[0].season_slug}</span> · {rosters.length}{" "}
              {rosters.length === 1 ? "stagione" : "stagioni"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rosters.map((r) => (
                <Link key={r.season_slug} href={`/stagioni/${r.season_slug}/squadra`}>
                  <Badge tone="secondary">
                    {r.season_slug}
                    {r.jersey_number ? ` · #${r.jersey_number}` : ""}
                  </Badge>
                </Link>
              ))}
            </div>
            {(photos.length > 1 || photos.some((r) => r.season_video_path)) && (
              // album delle figurine: una per stagione, la stagione più recente più grande e dritta
              <div className="mt-4 flex max-w-xl items-end gap-2 sm:gap-3">
                {photos.map((r, i) => {
                  const latest = i === photos.length - 1;
                  const media = mediaOf(r);
                  return (
                    <PhotoButton
                      key={r.season_slug}
                      index={i}
                      label={`Apri ${media.video ? "il video" : "la foto"} ${r.season_slug}`}
                      className={cx(
                        "group min-w-0 cursor-zoom-in text-center",
                        latest ? "flex-[1.45]" : "flex-1",
                      )}
                    >
                      <span
                        className={cx(
                          "relative block aspect-[4/5] overflow-hidden rounded-xl transition-transform duration-300 group-hover:rotate-0 group-hover:scale-[1.03]",
                          latest
                            ? "ring-2 ring-primary shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]"
                            : cx("ring-1 ring-white/15 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]", i % 2 ? "rotate-[1.5deg]" : "-rotate-[1.5deg]"),
                        )}
                      >
                        {media.video ? (
                          <video
                            src={media.url}
                            poster={videoPosterUrl(r.season_video_path) ?? undefined}
                            autoPlay
                            muted
                            loop
                            playsInline
                            aria-hidden
                            className="absolute inset-0 h-full w-full object-cover object-[50%_30%]"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- foto su Supabase Storage
                          <img src={media.url} alt={`${fullName} ${r.season_slug}`} className="absolute inset-0 h-full w-full object-cover object-top" />
                        )}
                        {r.jersey_number && (
                          <span className="display absolute right-1 top-1 rounded-md bg-black/35 px-1 pt-0.5 text-sm leading-none text-white backdrop-blur-sm">
                            {r.jersey_number}
                          </span>
                        )}
                      </span>
                      <span className={cx("mt-1.5 block truncate text-[0.65rem] tabular-nums", latest ? "font-semibold text-primary" : "text-text/70")}>
                        {r.season_slug}
                      </span>
                    </PhotoButton>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </header>
      </PhotoViewer>

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

      {mvps.length > 0 && (
        <section>
          <SectionTitle eyebrow={`${mvps.length} ${mvps.length === 1 ? "volta" : "volte"}`}>MVP della partita</SectionTitle>
          <MvpList matches={mvps} lines={gameLog} />
        </section>
      )}

      {played.length > 0 && (
        <section className="space-y-4">
          <SectionTitle eyebrow="Forma">Andamento</SectionTitle>
          <RecentForm lines={gameLog} />
          {trendSeason && <PointsTrend lines={gameLog} season={trendSeason} />}
        </section>
      )}

      {played.length > 0 && (
        <section>
          <SectionTitle eyebrow="Casa e trasferta, vittorie e sconfitte, fasi">Rendimento</SectionTitle>
          <ContextSplits lines={gameLog} />
        </section>
      )}

      <PlayerTotals
        seasonRows={seasonRows}
        careerRow={career ? { ...(career as TotalsRow), label: "Carriera" } : null}
        competitionRows={competitionRows}
      />

      {played.length > 0 && (
        <section>
          <SectionTitle eyebrow="Career high in una partita">Record personali</SectionTitle>
          <PersonalRecords scopes={records} />
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
