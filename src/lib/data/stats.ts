import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { StatDefinition } from "@/lib/domain/stats";
import { DATA_TAG, db, dbReady, unwrap } from "./core";
import type { CompetitionTotals, SeasonTotals } from "./players";

export async function getStatDefinitions(): Promise<StatDefinition[]> {
  "use cache";
  cacheLife("days");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const res = await db().from("stat_definitions").select("*").order("sort_order");
  return unwrap(res, "il catalogo statistiche");
}

export interface SeasonStats {
  seasonTotals: SeasonTotals[];
  competitionTotals: CompetitionTotals[];
  players: { id: string; slug: string; display_name: string; nickname: string | null; photo_path: string | null }[];
}

export async function getSeasonStats(seasonId: string): Promise<SeasonStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return { seasonTotals: [], competitionTotals: [], players: [] };
  const client = db();
  const [season, comps, players] = await Promise.all([
    client.from("v_player_season_totals").select("*").eq("season_id", seasonId),
    client.from("v_player_competition_totals").select("*").eq("season_id", seasonId),
    client.from("players").select("id, slug, display_name, nickname, photo_path"),
  ]);
  return {
    seasonTotals: unwrap(season, "le statistiche stagionali"),
    competitionTotals: unwrap(comps, "le statistiche per fase"),
    players: unwrap(players, "i giocatori").map((p) => ({ ...p, display_name: p.display_name ?? p.slug })),
  };
}
