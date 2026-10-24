/**
 * Calcolo di medie, percentuali e classifiche (leaderboard) a partire dai totali delle view
 * e dal catalogo stat_definitions. Nessun nome di statistica è cablato nella UI: aggiungere
 * una riga a stat_definitions basta per avere una nuova classifica.
 */
import type { Tables } from "@/lib/supabase/database.types";
import { formatNumber, formatPct } from "./format";

export type StatDefinition = Tables<"stat_definitions">;

/** Riga di totali (stagione, competizione o carriera): colonne numeriche + <col>_games. */
export type TotalsRow = { player_id: string | null } & Record<string, number | string | boolean | null>;

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function statValue(def: StatDefinition, row: TotalsRow): number | null {
  if (def.kind === "total") return n(row[def.column_name!]);
  if (def.kind === "per_game") {
    const total = n(row[def.column_name!]);
    const games = def.column_name === "games" ? n(row.games) : n(row[`${def.column_name}_games`]);
    return total === null || !games ? null : total / games;
  }
  const num = n(row[def.numerator_column!]);
  const den = n(row[def.denominator_column!]);
  return num === null || !den ? null : num / den;
}

/** Soglie minime: partite in cui la statistica è registrata e tentativi (per le percentuali). */
export function qualifies(def: StatDefinition, row: TotalsRow): boolean {
  if (def.min_games > 0) {
    const games = def.kind === "per_game" ? n(row[`${def.column_name}_games`]) : n(row.games);
    if ((games ?? 0) < def.min_games) return false;
  }
  if (def.kind === "percentage" && def.min_attempts > 0) {
    if ((n(row[def.denominator_column!]) ?? 0) < def.min_attempts) return false;
  }
  return true;
}

export function formatStat(def: StatDefinition, value: number | null): string {
  if (value === null) return "–";
  if (def.kind === "percentage") return formatPct(value, def.decimals);
  return formatNumber(value, def.kind === "per_game" ? Math.max(def.decimals, 1) : def.decimals);
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  value: number;
  display: string;
  /** contesto (es. "23/50" per le percentuali, "12 PG" per le medie) */
  detail: string | null;
}

export function buildLeaderboard(def: StatDefinition, rows: TotalsRow[], limit = 5): LeaderboardEntry[] {
  const entries = rows
    .filter((r) => r.player_id && qualifies(def, r))
    .map((r) => ({ row: r, value: statValue(def, r) }))
    .filter((e): e is { row: TotalsRow; value: number } => e.value !== null && (def.kind !== "total" || e.value !== 0))
    .sort((a, b) => (def.higher_is_better ? b.value - a.value : a.value - b.value));

  const out: LeaderboardEntry[] = [];
  entries.forEach((e, i) => {
    const prev = out[i - 1];
    const rank = prev && prev.value === e.value ? prev.rank : i + 1;
    let detail: string | null = null;
    if (def.kind === "percentage") detail = `${n(e.row[def.numerator_column!]) ?? 0}/${n(e.row[def.denominator_column!]) ?? 0}`;
    else if (def.kind === "per_game") detail = `${n(e.row[`${def.column_name}_games`]) ?? 0} PG`;
    out.push({ rank, playerId: e.row.player_id!, value: e.value, display: formatStat(def, e.value), detail });
  });
  return out.filter((e) => e.rank <= limit);
}

/** Descrizione leggibile della soglia minima, da mostrare sotto la classifica. */
export function thresholdLabel(def: StatDefinition): string | null {
  const parts: string[] = [];
  if (def.min_games > 0) parts.push(`almeno ${def.min_games} partite`);
  if (def.kind === "percentage" && def.min_attempts > 0) parts.push(`almeno ${def.min_attempts} tentativi`);
  if (parts.length === 0) return null;
  const text = parts.join(" e ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Somma righe di totali con la stessa chiave (es. le fasi di più stagioni dello stesso tipo).
 * Si sommano tutte le colonne numeriche, compresi i <col>_games: medie e percentuali restano
 * corrette. Una colonna resta null se è null in tutte le righe sommate.
 */
export function sumTotalsBy<K extends string>(rows: TotalsRow[], key: (r: TotalsRow) => K | null): (TotalsRow & { group: K })[] {
  const out = new Map<string, TotalsRow & { group: K }>();
  for (const r of rows) {
    const k = key(r);
    if (k === null || !r.player_id) continue;
    const id = `${r.player_id}|${k}`;
    const acc = out.get(id) ?? ({ player_id: r.player_id, group: k } as TotalsRow & { group: K });
    for (const [col, v] of Object.entries(r)) {
      if (typeof v !== "number") continue;
      const prev = acc[col];
      acc[col] = (typeof prev === "number" ? prev : 0) + v;
    }
    out.set(id, acc);
  }
  return [...out.values()];
}

export const PHASE_LABELS: Record<string, string> = {
  regular_season: "Regular season",
  poule: "Poule",
  playoff: "Playoff",
  cup: "Coppa",
  friendly: "Amichevoli",
  other: "Altro",
};
