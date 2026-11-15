import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PHASE_LABELS, sumTotalsBy, type StatDefinition, type TotalsRow } from "@/lib/domain/stats";
import type { RecordLine } from "@/lib/domain/records";
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
  players: { id: string; slug: string; display_name: string; nickname: string | null; photo_path: string | null; avatar_crop?: unknown }[];
}

export async function getSeasonStats(seasonId: string): Promise<SeasonStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return { seasonTotals: [], competitionTotals: [], players: [] };
  const client = db();
  const [season, comps, players, roster] = await Promise.all([
    client.from("v_player_season_totals").select("*").eq("season_id", seasonId),
    client.from("v_player_competition_totals").select("*").eq("season_id", seasonId),
    client.from("players").select("id, slug, display_name, nickname, photo_path"),
    client.from("v_season_roster").select("player_id, photo_path, avatar_crop").eq("season_id", seasonId),
  ]);
  // nelle statistiche di una stagione, la foto di quella stagione
  const seasonPhoto = new Map(unwrap(roster, "il roster").map((r) => [r.player_id, r]));
  return {
    seasonTotals: unwrap(season, "le statistiche stagionali"),
    competitionTotals: unwrap(comps, "le statistiche per fase"),
    players: unwrap(players, "i giocatori").map((p) => {
      const r = seasonPhoto.get(p.id);
      return { ...p, display_name: p.display_name ?? p.slug, photo_path: r?.photo_path ?? p.photo_path, avatar_crop: r?.photo_path ? r.avatar_crop : null };
    }),
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

export interface RecordsData {
  lines: RecordLine[];
  /** partite dei Bolo Sgreeners con il risultato, per i record di squadra */
  matches: { id: string; match_date: string | null; season_slug: string; opponent_name: string | null; own_side: string | null; own_score: number; opponent_score: number }[];
}

/** Tutte le prestazioni individuali (partite giocate) e i risultati, per i record di squadra e personali. */
export async function getRecordsData(): Promise<RecordsData> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return { lines: [], matches: [] };
  const client = db();
  // Supabase restituisce al massimo 1000 righe per richiesta: si legge a pagine
  const lines: RecordLine[] = [];
  for (let from = 0; ; from += 1000) {
    const page = unwrap(
      await client
        .from("v_player_game_lines")
        .select("match_id, match_date, season_slug, opponent_name, own_side, player_slug, player_name, points, reb, ast, stl, blk")
        .eq("participation", "played")
        .eq("is_own_team", true)
        .order("match_date")
        .order("id")
        .range(from, from + 999),
      "le prestazioni",
    );
    lines.push(...(page as RecordLine[]));
    if (page.length < 1000) break;
  }
  const matches = unwrap(
    await client
      .from("v_matches")
      .select("id, match_date, season_slug, opponent_name, own_side, own_score, opponent_score")
      .eq("involves_own_team", true)
      .not("own_score", "is", null)
      .not("opponent_score", "is", null),
    "i risultati",
  );
  return { lines, matches: matches as RecordsData["matches"] };
}
