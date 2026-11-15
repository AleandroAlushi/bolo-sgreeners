import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DATA_TAG, db, dbReady, unwrap, unwrapMaybe } from "./core";
import { getLeagueResults, getSeasonMatches, type LeagueResult, type MatchView } from "./matches";

export interface TeamGame {
  id: string;
  competitionName: string;
  roundLabel: string | null;
  date: string | null;
  home: boolean;
  opponentId: string | null;
  opponentName: string;
  opponentLogo: string | null;
  opponentIsOwn: boolean;
  scoreFor: number | null;
  scoreAgainst: number | null;
  /** periodi: [squadra, avversari] */
  periodsFor: number[] | null;
  periodsAgainst: number[] | null;
}

export interface TeamSeason {
  team: { id: string; slug: string; name: string; short_name: string | null; logo_path: string | null; is_own_team: boolean };
  games: TeamGame[];
  /** partite contro i Bolo Sgreeners, con box score e pagina partita */
  vsOwn: MatchView[];
  /** slug delle squadre del girone, per i link tra le schede */
  slugs: Record<string, string>;
}

const asGame = (r: LeagueResult, teamId: string): TeamGame => {
  const home = r.home_team_id === teamId;
  return {
    id: r.id!,
    competitionName: r.competition_name ?? "",
    roundLabel: r.round_label ?? (r.round_number ? `${r.round_number}ª giornata` : null),
    date: r.match_date,
    home,
    opponentId: home ? r.away_team_id : r.home_team_id,
    opponentName: (home ? r.away_name : r.home_name) ?? "?",
    opponentLogo: home ? r.away_team_logo : r.home_team_logo,
    opponentIsOwn: Boolean(home ? r.away_is_own : r.home_is_own),
    scoreFor: home ? r.home_score : r.away_score,
    scoreAgainst: home ? r.away_score : r.home_score,
    periodsFor: home ? r.home_periods : r.away_periods,
    periodsAgainst: home ? r.away_periods : r.home_periods,
  };
};

/** Scheda di una squadra del girone in una stagione: partite dal Livescore CSI e scontri con i Bolo Sgreeners. */
export async function getTeamSeason(seasonId: string, teamSlug: string): Promise<TeamSeason | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return null;
  const team = unwrapMaybe(
    await db().from("teams").select("id, slug, name, short_name, logo_path, is_own_team").eq("slug", teamSlug).maybeSingle(),
    "la squadra",
  );
  if (!team) return null;
  const [league, matches, teams] = await Promise.all([
    getLeagueResults(seasonId),
    getSeasonMatches(seasonId),
    db().from("teams").select("id, slug"),
  ]);
  const mine = league.filter((r) => r.home_team_id === team.id || r.away_team_id === team.id);
  if (mine.length === 0) return null;
  return {
    team,
    // in ordine di data (le gare dei playoff non hanno il numero di giornata)
    games: mine.map((r) => asGame(r, team.id)).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")),
    vsOwn: matches.filter((m) => m.opponent_id === team.id),
    slugs: Object.fromEntries(unwrap(teams, "le squadre").map((t) => [t.id, t.slug])),
  };
}

/** Slug delle squadre con almeno una partita nel girone della stagione (per i parametri statici). */
export async function getSeasonTeamSlugs(seasonId: string): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const league = await getLeagueResults(seasonId);
  const ids = new Set(league.flatMap((r) => [r.home_team_id, r.away_team_id]).filter((x): x is string => Boolean(x)));
  if (ids.size === 0) return [];
  const teams = unwrap(await db().from("teams").select("slug, is_own_team").in("id", [...ids]), "le squadre");
  return teams.filter((t) => !t.is_own_team).map((t) => t.slug);
}
