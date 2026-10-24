import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PHASE_LABELS, sumTotalsBy, type StatDefinition, type TotalsRow } from "@/lib/domain/stats";
import { DATA_TAG, db, dbReady, unwrap } from "./core";
import type { CareerTotals, CompetitionTotals, SeasonTotals } from "./players";

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

export interface AllTimeStats {
  careerTotals: CareerTotals[];
  /** totali per fase sommati su tutte le stagioni: competition_id = tipo di fase (regular_season, playoff, …) */
  phaseTotals: (TotalsRow & { competition_id: string })[];
  phases: { id: string; name: string }[];
  players: SeasonStats["players"];
  seasons: number;
}

/** Statistiche di tutte le stagioni insieme (carriera), con filtro per tipo di fase. */
export async function getAllTimeStats(): Promise<AllTimeStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return { careerTotals: [], phaseTotals: [], phases: [], players: [], seasons: 0 };
  const client = db();
  const [career, comps, competitions, players, seasons] = await Promise.all([
    client.from("v_player_career_totals").select("*"),
    client.from("v_player_competition_totals").select("*"),
    client.from("competitions").select("id, kind"),
    client.from("players").select("id, slug, display_name, nickname, photo_path"),
    client.from("seasons").select("id"),
  ]);
  const kindOf = new Map(unwrap(competitions, "le competizioni").map((c) => [c.id, c.kind as string]));
  const summed = sumTotalsBy(unwrap(comps, "le statistiche per fase") as TotalsRow[], (r) => kindOf.get(String(r.competition_id)) ?? null);
  const kinds = Object.keys(PHASE_LABELS).filter((k) => summed.some((r) => r.group === k));
  return {
    careerTotals: unwrap(career, "le statistiche di carriera"),
    phaseTotals: summed.map((r) => ({ ...r, competition_id: r.group })),
    phases: kinds.map((k) => ({ id: k, name: PHASE_LABELS[k] })),
    players: unwrap(players, "i giocatori").map((p) => ({ ...p, display_name: p.display_name ?? p.slug })),
    seasons: unwrap(seasons, "le stagioni").length,
  };
}
