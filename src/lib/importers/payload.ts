/**
 * Costruisce il payload per la funzione SQL `import_match_report` a partire da un report
 * normalizzato e dal mapping dei giocatori. Usato sia dall'admin sia dallo script storico,
 * così entrambi passano dallo stesso identico percorso di persistenza.
 */
import type { CoreStatKey, ImportIssue, NormalizedMatchReport, PlayerMapping, StatLine } from "./types";

const TEAM_STAT_KEYS = [
  "points", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "tov", "blk", "pf",
] as const satisfies readonly CoreStatKey[];

export interface PayloadConflict {
  field: string;
  primary_value: string | null;
  secondary_value: string | null;
  description: string;
}

export interface MatchReportPayloadInput {
  matchId: string;
  ownTeamId: string;
  seasonId: string | null;
  report: NormalizedMatchReport;
  /** stessa lunghezza e ordine di report.players */
  mappings: PlayerMapping[];
  file: { name: string; hash: string | null; size: number | null; storagePath: string | null };
  source: { kind: "html" | "excel" | "csi" | "livescore" | "instagram" | "pdf" | "photo" | "web" | "manual"; label: string; notes?: string };
  issues: ImportIssue[];
  overwrite: boolean;
  conflicts?: PayloadConflict[];
}

function pickTeamStats(s: StatLine | null) {
  if (!s) return null;
  return Object.fromEntries(TEAM_STAT_KEYS.map((k) => [k, s[k]]));
}

/** Totali di squadra calcolati dai giocatori quando il file non li contiene. */
function sumPlayers(report: NormalizedMatchReport): StatLine | null {
  const lines = report.players.filter((p) => p.participation === "played");
  if (lines.length === 0) return null;
  const total = {} as StatLine;
  for (const k of Object.keys(lines[0].stats) as CoreStatKey[]) {
    const values = lines.map((l) => l.stats[k]);
    total[k] = values.every((v) => v === null) ? null : values.reduce<number>((a, v) => a + (v ?? 0), 0);
  }
  return total;
}

export function buildMatchReportPayload(input: MatchReportPayloadInput) {
  const { report, mappings } = input;
  if (mappings.length !== report.players.length) {
    throw new Error("Il mapping dei giocatori non corrisponde alle righe del report");
  }

  const playerStats = report.players.flatMap((p, i) => {
    if (p.participation === "absent") return [];
    const m = mappings[i];
    return [
      {
        player_id: m.playerId,
        raw_name: p.name || p.rawLabel,
        jersey_number: p.jersey,
        participation: p.participation,
        ...p.stats,
        extra: p.extra,
      },
    ];
  });

  const ownTotals = report.own.totals ?? sumPlayers(report);
  const teamStats = [
    ownTotals && { side: "own", ...pickTeamStats(ownTotals) },
    report.opponent.totals && { side: "opponent", ...pickTeamStats(report.opponent.totals) },
  ].filter(Boolean);

  return {
    match_id: input.matchId,
    own_team_id: input.ownTeamId,
    overwrite: input.overwrite,
    file_date: report.date,
    result:
      report.own.score !== null && report.opponent.score !== null
        ? { own: report.own.score, opponent: report.opponent.score }
        : null,
    source: input.source,
    import: {
      file_name: input.file.name,
      file_hash: input.file.hash,
      file_size: input.file.size,
      storage_path: input.file.storagePath,
      parser: report.parser,
      parser_version: report.parserVersion,
      season_id: input.seasonId,
      parsed_payload: report,
      issues: input.issues,
    },
    player_stats: playerStats,
    team_stats: teamStats,
    periods: report.periods.map((p) => ({ period: p.period, own: p.own, opponent: p.opponent })),
    conflicts: input.conflicts ?? [],
  };
}

export type MatchReportPayload = ReturnType<typeof buildMatchReportPayload>;
