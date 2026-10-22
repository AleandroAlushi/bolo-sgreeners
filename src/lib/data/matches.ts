import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Tables } from "@/lib/supabase/database.types";
import { DATA_TAG, db, dbReady, unwrap, unwrapMaybe } from "./core";

export type MatchView = Tables<"v_matches">;
export type PlayerGameLine = Tables<"v_player_game_lines">;
export type TeamMatchStats = Tables<"team_match_stats">;
export type PeriodScore = Tables<"match_period_scores">;
export type DataSource = Tables<"data_sources">;

const byDate = (a: MatchView, b: MatchView) =>
  (a.match_date ?? "9999").localeCompare(b.match_date ?? "9999") || (a.start_time ?? "").localeCompare(b.start_time ?? "");

export async function getSeasonMatches(seasonId: string): Promise<MatchView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const res = await db().from("v_matches").select("*").eq("season_id", seasonId);
  return unwrap(res, "il calendario").sort((a, b) => (a.phase_order ?? 0) - (b.phase_order ?? 0) || byDate(a, b));
}

export async function getAllMatchIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const res = await db().from("matches").select("id");
  return unwrap(res, "le partite").map((m) => m.id);
}

export interface MatchDetail {
  match: MatchView;
  periods: PeriodScore[];
  playerLines: PlayerGameLine[];
  teamStats: TeamMatchStats[];
  sources: DataSource[];
  /** giocatore MVP della partita, se indicato */
  mvpPlayerId: string | null;
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const client = db();
  const match = unwrapMaybe(await client.from("v_matches").select("*").eq("id", id).maybeSingle(), "la partita");
  if (!match) return null;
  const [periods, lines, teamStats, mvp] = await Promise.all([
    client.from("match_period_scores").select("*").eq("match_id", id).order("period"),
    client.from("v_player_game_lines").select("*").eq("match_id", id),
    client.from("team_match_stats").select("*").eq("match_id", id),
    client.from("match_awards").select("player_id").eq("match_id", id).eq("award", "mvp").maybeSingle(),
  ]);
  const playerLines = unwrap(lines, "il box score").sort(
    (a, b) => (a.participation === b.participation ? (b.points ?? -1) - (a.points ?? -1) : a.participation === "played" ? -1 : 1),
  );
  const ts = unwrap(teamStats, "le statistiche di squadra");
  const per = unwrap(periods, "i parziali");
  const sourceIds = [
    ...new Set([match.schedule_source_id, match.result_source_id, ...playerLines.map((l) => l.source_id), ...per.map((p) => p.source_id)].filter(
      (x): x is string => Boolean(x),
    )),
  ];
  const sources = sourceIds.length
    ? unwrap(await client.from("data_sources").select("*").in("id", sourceIds), "le fonti")
    : [];
  return { match, periods: per, playerLines, teamStats: ts, sources, mvpPlayerId: unwrapMaybe(mvp, "l'MVP")?.player_id ?? null };
}

/** Ultima partita giocata e prossima in programma tra quelle dei Bolo Sgreeners. */
export function lastAndNext(matches: MatchView[], today: string) {
  const own = matches.filter((m) => m.involves_own_team);
  const played = own.filter((m) => m.own_result !== null).sort(byDate);
  const upcoming = own
    .filter((m) => m.status === "scheduled" && (m.match_date === null || m.match_date >= today))
    .sort(byDate);
  return { last: played.at(-1) ?? null, next: upcoming[0] ?? null };
}
