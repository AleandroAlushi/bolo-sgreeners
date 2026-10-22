/**
 * Validazione di una partita importata. Non blocca nulla da sola: produce un elenco di
 * problemi (error = impedisce il salvataggio, warning/info = da mostrare e tracciare).
 */
import { CORE_STAT_KEYS, type ImportIssue, type NormalizedMatchReport, type PlayerMapping, type StatLine } from "./types";
import { pointsFromShooting } from "./normalize";

export interface ValidationContext {
  /** risultato ufficiale già presente nel database (fonte primaria CSI) */
  officialScore?: { own: number; opponent: number } | null;
  /** data della partita già presente nel database */
  scheduledDate?: string | null;
  mappings?: PlayerMapping[];
}

function sumPlayers(report: NormalizedMatchReport, key: keyof StatLine): number | null {
  const values = report.players.filter((p) => p.didPlay).map((p) => p.stats[key]);
  if (values.length === 0 || values.every((v) => v === null)) return null;
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

export function validateImportedMatch(
  report: NormalizedMatchReport,
  ctx: ValidationContext = {},
): ImportIssue[] {
  const issues: ImportIssue[] = [...report.issues];

  if (report.players.length === 0) {
    issues.push({ level: "error", code: "no_players", message: "Nessun giocatore trovato nel file" });
  }
  if (report.players.every((p) => !p.didPlay)) {
    issues.push({ level: "error", code: "no_player_played", message: "Nessun giocatore risulta sceso in campo" });
  }

  for (const p of report.players) {
    for (const k of CORE_STAT_KEYS) {
      const v = p.stats[k];
      if (v !== null && v < 0 && k !== "plus_minus") {
        issues.push({ level: "error", code: "negative_stat", message: `Valore negativo per ${k}`, ref: p.rawLabel });
      }
    }
    const pairs: [keyof StatLine, keyof StatLine][] = [["fgm", "fga"], ["fg3m", "fg3a"], ["ftm", "fta"], ["fg3m", "fgm"]];
    for (const [made, att] of pairs) {
      const m = p.stats[made];
      const a = p.stats[att];
      if (m !== null && a !== null && m > a) {
        issues.push({ level: "error", code: "made_gt_attempted", message: `${made} maggiore di ${att}`, ref: p.rawLabel });
      }
    }
    const expected = pointsFromShooting(p.stats);
    if (expected !== null && p.stats.points !== null && expected !== p.stats.points) {
      issues.push({
        level: "warning",
        code: "points_mismatch_player",
        message: `Punti (${p.stats.points}) diversi da quelli calcolati dai tiri (${expected})`,
        ref: p.rawLabel,
      });
    }
  }

  const playerPoints = sumPlayers(report, "points");
  const ownTotals = report.own.totals;
  if (ownTotals?.points != null && playerPoints !== null && ownTotals.points !== playerPoints) {
    issues.push({
      level: "warning",
      code: "team_total_mismatch",
      message: `Somma punti giocatori (${playerPoints}) diversa dal totale squadra del file (${ownTotals.points})`,
    });
  }
  if (report.own.score !== null && playerPoints !== null && report.own.score !== playerPoints) {
    issues.push({
      level: "warning",
      code: "score_vs_players_mismatch",
      message: `Punteggio nel file (${report.own.score}) diverso dalla somma dei punti dei giocatori (${playerPoints})`,
    });
  }

  if (report.periods.length > 0 && report.own.score !== null && report.opponent.score !== null) {
    const ownSum = report.periods.reduce((a, p) => a + p.own, 0);
    const oppSum = report.periods.reduce((a, p) => a + p.opponent, 0);
    if (ownSum !== report.own.score || oppSum !== report.opponent.score) {
      issues.push({
        level: "warning",
        code: "periods_mismatch",
        message: `Somma dei parziali (${ownSum}-${oppSum}) diversa dal punteggio (${report.own.score}-${report.opponent.score})`,
      });
    }
  }

  if (ctx.officialScore && report.own.score !== null && report.opponent.score !== null) {
    if (ctx.officialScore.own !== report.own.score || ctx.officialScore.opponent !== report.opponent.score) {
      issues.push({
        level: "warning",
        code: "official_score_conflict",
        message: `Risultato del file ${report.own.score}-${report.opponent.score} diverso dal risultato ufficiale ${ctx.officialScore.own}-${ctx.officialScore.opponent}: vale quello ufficiale, la discrepanza verrà registrata`,
      });
    }
  }
  if (ctx.scheduledDate && report.date && ctx.scheduledDate !== report.date) {
    issues.push({
      level: "warning",
      code: "date_conflict",
      message: `Data del file (${report.date}) diversa da quella della partita (${ctx.scheduledDate})`,
    });
  }

  for (const m of ctx.mappings ?? []) {
    if (m.status === "unmatched") {
      issues.push({ level: "error", code: "player_unmatched", message: `Giocatore non riconosciuto: "${m.rawLabel}"`, ref: m.rawLabel });
    } else if (m.status === "ambiguous") {
      issues.push({ level: "error", code: "player_ambiguous", message: `Giocatore ambiguo: "${m.rawLabel}" (${m.reason})`, ref: m.rawLabel });
    }
  }

  return issues;
}

export const hasBlockingIssues = (issues: ImportIssue[]) => issues.some((i) => i.level === "error");
