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

export async function getPlayers(): Promise<(Player & { seasons: string[]; staffRoles: string[]; career: CareerTotals | null; avatar_crop: unknown })[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const client = db();
  const [players, rosters, career, staff] = await Promise.all([
    client.from("players").select("*").order("last_name"),
    client.from("v_season_roster").select("player_id, season_slug, photo_path, avatar_crop"),
    client.from("v_player_career_totals").select("*"),
    client.from("v_season_staff").select("player_id, season_slug, role").not("player_id", "is", null),
  ]);
  const r = unwrap(rosters, "i roster");
  const st = unwrap(staff, "lo staff");
  const c = unwrap(career, "le statistiche di carriera");
  return unwrap(players, "i giocatori").map((p) => {
    // la foto predefinita del giocatore (la caricatura); senza, quella dell'ultima stagione che ne ha una
    const latest = r.filter((x) => x.player_id === p.id && x.photo_path).sort((a, b) => b.season_slug!.localeCompare(a.season_slug!))[0];
    return {
    ...p,
    photo_path: p.photo_path ?? latest?.photo_path ?? null,
    avatar_crop: (p.photo_path ? p.avatar_crop : latest?.avatar_crop) ?? null,
    // stagioni con la squadra: da giocatore e da staff (chi fa entrambe le cose è una persona sola)
    seasons: [...new Set([...r, ...st].filter((x) => x.player_id === p.id).map((x) => x.season_slug!))].sort(),
    staffRoles: [...new Set(st.filter((x) => x.player_id === p.id).map((x) => x.role!))],
    career: c.find((x) => x.player_id === p.id) ?? null,
    };
  });
}

export interface StaffPerson {
  slug: string;
  firstName: string;
  lastName: string;
  roles: string[];
  seasons: string[];
  latestSeason: string;
  photoPath: string | null;
}

/** Tutto lo staff di sempre, tranne chi è anche giocatore (sta già tra i giocatori). */
export async function getAllStaff(): Promise<StaffPerson[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const rows = unwrap(await db().from("v_season_staff").select("*").is("player_id", null).order("season_slug"), "lo staff");
  const byId = new Map<string, StaffEntry[]>();
  for (const x of rows) byId.set(x.staff_id!, [...(byId.get(x.staff_id!) ?? []), x]);
  return [...byId.values()].map((list) => {
    const latest = list.at(-1)!;
    return {
      slug: latest.slug!,
      firstName: latest.first_name!,
      lastName: latest.last_name!,
      // ruoli dal più recente
      roles: [...new Set([...list].reverse().map((x) => x.role!))],
      seasons: [...new Set(list.map((x) => x.season_slug!))],
      latestSeason: latest.season_slug!,
      photoPath: [...list].reverse().find((x) => x.photo_path)?.photo_path ?? null,
    };
  });
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
  const [rosters, seasonTotals, compTotals, career, log, awards, staffRoles] = await Promise.all([
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
    rosters: unwrap(rosters, "le stagioni del giocatore").sort((a, b) => (a.season_slug ?? "").localeCompare(b.season_slug ?? "")),
    seasonTotals: unwrap(seasonTotals, "le statistiche stagionali"),
    competitionTotals: unwrap(compTotals, "le statistiche per fase"),
    career: unwrapMaybe(career, "le statistiche di carriera"),
    gameLog: unwrap(log, "le partite del giocatore"),
    mvps,
    staffRoles: unwrap(staffRoles, "i ruoli nello staff"),
  };
}
