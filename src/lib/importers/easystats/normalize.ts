/**
 * Normalizzazione di un RawBoxScore Easy Stats in un NormalizedMatchReport.
 * Converte le colonne del file nelle chiavi canoniche e distingue la squadra di casa nostra
 * dall'avversaria tramite i nomi noti (passati dall'esterno: nessun nome hardcoded).
 */
import {
  emptyStatLine,
  hasAnyNonZero,
  normalizeTeamName,
  parseIntCell,
  parseJerseyLabel,
  parseMadeAttempted,
  parseMatchDate,
  withDerivedRebounds,
} from "../normalize";
import { CORE_STAT_KEYS } from "../types";
import type {
  CoreStatKey,
  ImportIssue,
  NormalizedMatchReport,
  NormalizedPlayerLine,
  RawBoxScore,
  RawStatRow,
  StatLine,
} from "../types";

type ColumnRule =
  | { kind: "pair"; made: CoreStatKey; attempted: CoreStatKey }
  | { kind: "int"; key: CoreStatKey }
  | { kind: "ignore" };

/** Colonne Easy Stats conosciute. Le percentuali sono ignorate perché derivabili. */
const COLUMN_RULES: Record<string, ColumnRule> = {
  "fg*": { kind: "pair", made: "fgm", attempted: "fga" },
  fg: { kind: "pair", made: "fgm", attempted: "fga" },
  "3pt": { kind: "pair", made: "fg3m", attempted: "fg3a" },
  ft: { kind: "pair", made: "ftm", attempted: "fta" },
  oreb: { kind: "int", key: "oreb" },
  dreb: { kind: "int", key: "dreb" },
  reb: { kind: "int", key: "reb" },
  foul: { kind: "int", key: "pf" },
  stl: { kind: "int", key: "stl" },
  to: { kind: "int", key: "tov" },
  blk: { kind: "int", key: "blk" },
  asst: { kind: "int", key: "ast" },
  "+/-": { kind: "int", key: "plus_minus" },
  min: { kind: "int", key: "minutes" },
  pts: { kind: "int", key: "points" },
  "fg%": { kind: "ignore" },
  "fg*%": { kind: "ignore" },
  "3pt%": { kind: "ignore" },
  "ft%": { kind: "ignore" },
};

function parseRow(columns: string[], row: RawStatRow): { stats: StatLine; extra: Record<string, string> } {
  const stats = emptyStatLine();
  const extra: Record<string, string> = {};
  columns.forEach((col, i) => {
    const cell = row.cells[i] ?? "";
    const rule = COLUMN_RULES[col];
    if (!rule) {
      if (cell !== "" && cell !== "-") extra[col] = cell;
      return;
    }
    if (rule.kind === "pair") {
      const pair = parseMadeAttempted(cell);
      if (pair) {
        stats[rule.made] = pair[0];
        stats[rule.attempted] = pair[1];
      }
    } else if (rule.kind === "int") {
      stats[rule.key] = parseIntCell(cell);
    }
  });
  return { stats: withDerivedRebounds(stats), extra };
}

export interface NormalizeOptions {
  /** nomi con cui la nostra squadra compare nei file (es. dalla tabella team_aliases) */
  ownTeamNames: string[];
}

function matchesOwnTeam(name: string, ownTeamNames: string[]): boolean {
  const n = normalizeTeamName(name);
  return ownTeamNames.some((own) => {
    const o = normalizeTeamName(own);
    return o.length > 0 && (n === o || n.includes(o));
  });
}

export function normalizeEasyStats(raw: RawBoxScore, opts: NormalizeOptions): NormalizedMatchReport {
  const issues: ImportIssue[] = [];

  const leftIsOwn = matchesOwnTeam(raw.left.name, opts.ownTeamNames);
  const rightIsOwn = matchesOwnTeam(raw.right.name, opts.ownTeamNames);
  if (leftIsOwn === rightIsOwn) {
    issues.push({
      level: "error",
      code: "own_team_not_identified",
      message: `Impossibile capire quale squadra sia la nostra ("${raw.left.name}" / "${raw.right.name}")`,
    });
  }
  const ownIsLeft = leftIsOwn || !rightIsOwn;

  const unknownColumns = raw.columns.filter((c) => !(c in COLUMN_RULES));
  for (const c of unknownColumns) {
    issues.push({
      level: "warning",
      code: "unknown_column",
      message: `Colonna "${c}" non riconosciuta: conservata come dato extra`,
      ref: c,
    });
  }

  const players: NormalizedPlayerLine[] = raw.playerRows.map((row) => {
    const { jersey, name } = parseJerseyLabel(row.label);
    const { stats, extra } = parseRow(raw.columns, row);
    // In campo se ha minuti > 0 oppure almeno una statistica non nulla.
    // Nel formato senza minuti un giocatore a referto con tutti zeri non è distinguibile
    // da uno non entrato: viene considerato "non entrato" (documentato).
    const didPlay = (stats.minutes ?? 0) > 0 || hasAnyNonZero({ ...stats, minutes: null });
    const absent = !didPlay && CORE_STAT_KEYS.every((k) => k === "minutes" || stats[k] === null);
    const participation = didPlay ? "played" : absent ? "absent" : "dnp";
    return { rawLabel: row.label, name, jersey, participation, didPlay, stats, extra };
  });

  const teamTotalsByName = new Map<string, StatLine>();
  for (const row of raw.teamRows) {
    teamTotalsByName.set(normalizeTeamName(row.label), parseRow(raw.columns, row).stats);
  }
  const totalsFor = (name: string): StatLine | null =>
    teamTotalsByName.get(normalizeTeamName(name)) ?? null;

  const ownRaw = ownIsLeft ? raw.left : raw.right;
  const oppRaw = ownIsLeft ? raw.right : raw.left;

  const own = {
    rawName: ownRaw.name,
    score: ownRaw.score,
    appSide: ownRaw.appSide,
    totals: totalsFor(ownRaw.name),
    isOwnTeam: true,
  };
  const opponent = {
    rawName: oppRaw.name,
    score: oppRaw.score,
    appSide: oppRaw.appSide,
    totals: totalsFor(oppRaw.name),
    isOwnTeam: false,
  };
  if (raw.teamRows.length === 0) {
    issues.push({
      level: "info",
      code: "no_team_totals",
      message: "Il file non contiene le righe dei totali di squadra: verranno calcolati dai giocatori",
    });
  }

  const periods = raw.periods.map((p, i) => ({
    period: i + 1,
    label: p.label,
    own: ownIsLeft ? p.left : p.right,
    opponent: ownIsLeft ? p.right : p.left,
  }));

  const date = parseMatchDate(raw.dateText);
  if (!date) {
    issues.push({
      level: "warning",
      code: "date_not_parsed",
      message: `Data della partita non interpretabile: "${raw.dateText ?? ""}"`,
    });
  }

  const statKeys = new Set<CoreStatKey>();
  for (const col of raw.columns) {
    const rule = COLUMN_RULES[col];
    if (rule?.kind === "pair") {
      statKeys.add(rule.made);
      statKeys.add(rule.attempted);
    } else if (rule?.kind === "int") statKeys.add(rule.key);
  }
  if (statKeys.has("oreb") && statKeys.has("dreb")) statKeys.add("reb");

  return {
    parser: raw.parser,
    parserVersion: raw.parserVersion,
    formatVariant: raw.formatVariant,
    date,
    own,
    opponent,
    periods,
    players,
    availableStats: [...statKeys],
    shots: {
      own: ownIsLeft ? raw.shots.left : raw.shots.right,
      opponent: ownIsLeft ? raw.shots.right : raw.shots.left,
    },
    rosterIds: raw.rosterIds,
    issues,
  };
}
