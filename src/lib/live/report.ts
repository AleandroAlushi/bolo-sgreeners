/**
 * Fine partita: gli eventi della diretta diventano un NormalizedMatchReport, lo stesso formato
 * del box score HTML di Easy Stats. Così il salvataggio passa dalla stessa funzione
 * (buildMatchReportPayload → import_match_report) e le statistiche si comportano come sempre.
 */
import { CORE_STAT_KEYS, type NormalizedMatchReport, type PlayerMapping, type StatLine } from "@/lib/importers/types";
import { periodShort, summarize, finalClock, type LiveEvent, type LiveRosterEntry } from "./engine";

export const LIVE_PARSER = "sito-live";
export const LIVE_PARSER_VERSION = "1";

export interface LiveGameForReport {
  period: number;
  periods: number;
  period_seconds: number;
  roster: LiveRosterEntry[];
  opponent_name: string | null;
}

export function buildLiveReport(
  game: LiveGameForReport,
  events: LiveEvent[],
  ctx: { date: string | null; ownName: string; opponentName: string },
): { report: NormalizedMatchReport; mappings: PlayerMapping[] } {
  const s = summarize(events, game.roster, finalClock(game.period, game.periods, game.period_seconds));
  // in campo = entrato o con almeno una statistica; gli altri convocati restano "non entrati"
  const lines = game.roster.map((r) => {
    const l = s.players.get(r.player_id)!;
    const stats: StatLine = Object.fromEntries(CORE_STAT_KEYS.map((k) => [k, l[k]])) as StatLine;
    const anyStat = CORE_STAT_KEYS.some((k) => k !== "minutes" && k !== "plus_minus" && (l[k] ?? 0) !== 0);
    const played = l.entered || anyStat;
    return { r, stats, played };
  });
  const report: NormalizedMatchReport = {
    parser: LIVE_PARSER,
    parserVersion: LIVE_PARSER_VERSION,
    formatVariant: s.usesClock ? "con-orologio" : "senza-orologio",
    date: ctx.date,
    own: { rawName: ctx.ownName, score: s.score.own, appSide: null, totals: s.own, isOwnTeam: true },
    opponent: { rawName: ctx.opponentName, score: s.score.opp, appSide: null, totals: s.opponent, isOwnTeam: false },
    periods: s.periods.map((p, i) => ({ period: i + 1, label: periodShort(i + 1, game.periods), own: p.own, opponent: p.opp })),
    players: lines.map(({ r, stats, played }) => ({
      rawLabel: `#${r.jersey ?? ""} ${r.name}`.trim(),
      name: r.name,
      jersey: r.jersey,
      participation: played ? "played" : "dnp",
      didPlay: played,
      stats: played ? stats : { ...stats, minutes: s.usesClock ? 0 : null },
      extra: {},
    })),
    availableStats: CORE_STAT_KEYS.filter((k) => k !== "minutes" || s.usesClock),
    shots: { own: [], opponent: [] },
    rosterIds: [],
    issues: [],
  };
  const mappings: PlayerMapping[] = game.roster.map((r) => ({
    rawLabel: `#${r.jersey ?? ""} ${r.name}`.trim(),
    name: r.name,
    jersey: r.jersey,
    status: "matched",
    playerId: r.player_id,
    candidates: [],
    reason: "Statistiche prese dal sito",
  }));
  return { report, mappings };
}
