import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Tables } from "@/lib/supabase/database.types";
import { DATA_TAG, db, dbReady, unwrap, unwrapMaybe } from "./core";
import type { PlayerGameLine } from "./matches";

export type Player = Tables<"players">;
export type RosterEntry = Tables<"v_season_roster">;
export type SeasonTotals = Tables<"v_player_season_totals">;
export type CompetitionTotals = Tables<"v_player_competition_totals">;
export type CareerTotals = Tables<"v_player_career_totals">;
export type StaffEntry = Tables<"v_season_staff">;
export type MatchView = Tables<"v_matches">;

export async function getPlayers(): Promise<(Player & { seasons: string[]; career: CareerTotals | null })[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const client = db();
  const [players, rosters, career] = await Promise.all([
    client.from("players").select("*").order("last_name"),
    client.from("v_season_roster").select("player_id, season_slug"),
    client.from("v_player_career_totals").select("*"),
  ]);
  const r = unwrap(rosters, "i roster");
  const c = unwrap(career, "le statistiche di carriera");
  return unwrap(players, "i giocatori").map((p) => ({
    ...p,
    seasons: r.filter((x) => x.player_id === p.id).map((x) => x.season_slug!).sort(),
    career: c.find((x) => x.player_id === p.id) ?? null,
  }));
}

export async function getSeasonRoster(seasonId: string): Promise<RosterEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const res = await db().from("v_season_roster").select("*").eq("season_id", seasonId);
  return unwrap(res, "il roster").sort(
    (a, b) => Number(a.jersey_number ?? 999) - Number(b.jersey_number ?? 999) || (a.last_name ?? "").localeCompare(b.last_name ?? ""),
  );
}

export async function getSeasonStaff(seasonId: string): Promise<StaffEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const res = await db().from("v_season_staff").select("*").eq("season_id", seasonId).order("sort_order");
  return unwrap(res, "lo staff");
}

export interface PlayerProfile {
  player: Player;
  aliases: string[];
  rosters: RosterEntry[];
  seasonTotals: SeasonTotals[];
  competitionTotals: CompetitionTotals[];
  career: CareerTotals | null;
  gameLog: PlayerGameLine[];
  /** partite in cui è stato MVP (più recente prima) */
  mvps: MatchView[];
  /** ruoli nello staff, per chi fa anche parte dello staff */
  staffRoles: StaffEntry[];
}

export async function getPlayerProfile(slug: string): Promise<PlayerProfile | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return null;
  const client = db();
  const player = unwrapMaybe(await client.from("players").select("*").eq("slug", slug).maybeSingle(), "il giocatore");
  if (!player) return null;
  const [aliases, rosters, seasonTotals, compTotals, career, log, awards, staffRoles] = await Promise.all([
    client.from("player_aliases").select("alias").eq("player_id", player.id),
    client.from("v_season_roster").select("*").eq("player_id", player.id),
    client.from("v_player_season_totals").select("*").eq("player_id", player.id),
    client.from("v_player_competition_totals").select("*").eq("player_id", player.id),
    client.from("v_player_career_totals").select("*").eq("player_id", player.id).maybeSingle(),
    client.from("v_player_game_lines").select("*").eq("player_id", player.id).order("match_date", { ascending: false }),
    client.from("match_awards").select("match_id").eq("player_id", player.id).eq("award", "mvp"),
    client.from("v_season_staff").select("*").eq("player_id", player.id).order("season_slug"),
  ]);
  const mvpIds = unwrap(awards, "gli MVP").map((a) => a.match_id);
  const mvps = mvpIds.length
    ? unwrap(await client.from("v_matches").select("*").in("id", mvpIds).order("match_date", { ascending: false }), "le partite da MVP")
    : [];
  return {
    player,
    aliases: [...new Set(unwrap(aliases, "gli alias").map((a) => a.alias))],
    rosters: unwrap(rosters, "le stagioni del giocatore").sort((a, b) => (a.season_slug ?? "").localeCompare(b.season_slug ?? "")),
    seasonTotals: unwrap(seasonTotals, "le statistiche stagionali"),
    competitionTotals: unwrap(compTotals, "le statistiche per fase"),
    career: unwrapMaybe(career, "le statistiche di carriera"),
    gameLog: unwrap(log, "le partite del giocatore"),
    mvps,
    staffRoles: unwrap(staffRoles, "i ruoli nello staff"),
  };
}
