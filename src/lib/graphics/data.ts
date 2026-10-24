import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DATA_TAG, db, dbReady, unwrap } from "@/lib/data/core";
import { getMatchDetail, getSeasonMatches, type MatchDetail, type MatchView } from "@/lib/data/matches";
import { getSeason } from "@/lib/data/seasons";
import { publicMediaUrl } from "@/lib/media";

/** Loghi delle squadre caricati dall'admin (bucket media). */
async function getTeamLogos(): Promise<Record<string, string>> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return {};
  const res = await db().from("teams").select("id, logo_path").not("logo_path", "is", null);
  return Object.fromEntries(unwrap(res, "i loghi").map((t) => [t.id, publicMediaUrl(t.logo_path)!]));
}

export interface GraphicMatch extends MatchDetail {
  opponentLogo: string | null;
  /** Sgreeners in casa (null se non si sa) */
  home: boolean | null;
}

export async function getGraphicMatch(id: string): Promise<GraphicMatch | null> {
  const [detail, logos] = await Promise.all([getMatchDetail(id), getTeamLogos()]);
  if (!detail) return null;
  const m = detail.match;
  return { ...detail, opponentLogo: m.opponent_id ? (logos[m.opponent_id] ?? null) : null, home: m.own_side === "home" ? true : m.own_side === "away" ? false : null };
}

export interface MonthMatch {
  match: MatchView;
  opponentLogo: string | null;
  home: boolean | null;
}

/** Partite degli Sgreeners di un mese (yyyy-mm) della stagione, in ordine di data. */
export async function getMonthMatches(seasonSlug: string, month: string): Promise<{ season: string; matches: MonthMatch[] } | null> {
  const season = await getSeason(seasonSlug);
  if (!season || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [all, logos] = await Promise.all([getSeasonMatches(season.id), getTeamLogos()]);
  const matches = all
    .filter((m) => m.involves_own_team && m.match_date?.startsWith(month) && m.status !== "cancelled")
    .sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .map((m) => ({ match: m, opponentLogo: m.opponent_id ? (logos[m.opponent_id] ?? null) : null, home: m.own_side === "home" ? true : m.own_side === "away" ? false : null }));
  return { season: season.slug, matches };
}
