import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Tables } from "@/lib/supabase/database.types";
import { DATA_TAG, db, dbReady, unwrap } from "./core";

export type Season = Tables<"seasons">;
export type Competition = Tables<"competitions">;
export type CompetitionRecord = Tables<"v_own_competition_records">;

export interface SeasonSummary extends Season {
  competitions: Competition[];
  records: CompetitionRecord[];
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export async function getSeasons(): Promise<SeasonSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const client = db();
  const [seasons, competitions, records] = await Promise.all([
    client.from("seasons").select("*").order("slug", { ascending: false }),
    client.from("competitions").select("*").order("phase_order"),
    client.from("v_own_competition_records").select("*").order("phase_order"),
  ]);
  const comps = unwrap(competitions, "le competizioni");
  const recs = unwrap(records, "i record di squadra");
  return unwrap(seasons, "le stagioni").map((s) => {
    const seasonRecs = recs.filter((r) => r.season_id === s.id);
    const sum = (k: "played" | "wins" | "losses" | "points_for" | "points_against") =>
      seasonRecs.reduce((a, r) => a + (r[k] ?? 0), 0);
    return {
      ...s,
      competitions: comps.filter((c) => c.season_id === s.id),
      records: seasonRecs,
      played: sum("played"),
      wins: sum("wins"),
      losses: sum("losses"),
      pointsFor: sum("points_for"),
      pointsAgainst: sum("points_against"),
    };
  });
}

export async function getSeason(slug: string): Promise<SeasonSummary | null> {
  const seasons = await getSeasons();
  return seasons.find((s) => s.slug === slug) ?? null;
}

/**
 * Stagione da mostrare di default: quella corrente se ha partite in calendario,
 * altrimenti la più recente con partite (la corrente resta segnalata a parte).
 */
export async function getFeaturedSeason(): Promise<{ featured: SeasonSummary | null; current: SeasonSummary | null }> {
  const seasons = await getSeasons();
  const current = seasons.find((s) => s.is_current) ?? seasons[0] ?? null;
  const hasMatches = (s: SeasonSummary) => s.records.some((r) => (r.played ?? 0) + (r.scheduled ?? 0) > 0);
  const featured = current && hasMatches(current) ? current : (seasons.find(hasMatches) ?? current);
  return { featured, current };
}
