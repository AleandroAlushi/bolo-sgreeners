/** Record in una singola partita: career high dei giocatori e record di squadra. */

export const RECORD_STATS = [
  { key: "points", label: "Punti", short: "PTS" },
  { key: "reb", label: "Rimbalzi", short: "RT" },
  { key: "ast", label: "Assist", short: "AST" },
  { key: "stl", label: "Recuperi", short: "REC" },
  { key: "blk", label: "Stoppate", short: "STP" },
] as const;

export type RecordStat = (typeof RECORD_STATS)[number]["key"];

/** Una riga del log partita, ridotta a quello che serve per i record. */
export interface RecordLine {
  match_id: string;
  match_date: string | null;
  season_slug: string;
  opponent_name: string | null;
  own_side: string | null;
  player_slug?: string | null;
  player_name?: string | null;
  points: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
}

export interface RecordEntry {
  value: number;
  matchId: string;
  date: string | null;
  opponent: string;
  away: boolean;
  playerSlug: string | null;
  playerName: string | null;
  /** altre partite con lo stesso valore (record eguagliato) */
  ties: number;
}

const entry = (l: RecordLine, k: RecordStat, ties = 0): RecordEntry => ({
  value: l[k]!,
  matchId: l.match_id,
  date: l.match_date,
  opponent: l.opponent_name ?? "?",
  away: l.own_side === "away",
  playerSlug: l.player_slug ?? null,
  playerName: l.player_name ?? null,
  ties,
});

/** Le migliori `top` prestazioni per statistica (a pari valore la prima in ordine di tempo). Zero non è un record. */
export function topPerformances(lines: RecordLine[], top = 1): Record<RecordStat, RecordEntry[]> {
  const out = {} as Record<RecordStat, RecordEntry[]>;
  for (const { key } of RECORD_STATS) {
    const valid = lines
      .filter((l) => l[key] !== null && l[key]! > 0)
      .sort((a, b) => b[key]! - a[key]! || (a.match_date ?? "9999").localeCompare(b.match_date ?? "9999"));
    out[key] = valid.slice(0, top).map((l, i) => entry(l, key, i === 0 && top === 1 ? valid.filter((x) => x[key] === l[key]).length - 1 : 0));
  }
  return out;
}

export interface RecordScope {
  /** "sempre" oppure lo slug della stagione */
  id: string;
  label: string;
  records: Record<RecordStat, RecordEntry[]>;
}

/** Record di sempre e di ogni stagione (dalla più recente). */
export function recordScopes(lines: RecordLine[], top = 1): RecordScope[] {
  const seasons = [...new Set(lines.map((l) => l.season_slug))].sort().reverse();
  return [
    { id: "sempre", label: "Di sempre", records: topPerformances(lines, top) },
    ...seasons.map((s) => ({ id: s, label: s, records: topPerformances(lines.filter((l) => l.season_slug === s), top) })),
  ];
}

export interface TeamGameRecord {
  label: string;
  value: string;
  matchId: string;
  detail: string;
}

export interface OwnResult {
  id: string;
  match_date: string | null;
  season_slug: string;
  opponent_name: string | null;
  own_side: string | null;
  own_score: number;
  opponent_score: number;
}

/** Record delle partite della squadra: più punti segnati, vittoria più larga, meno punti subiti. */
export function teamGameRecords(results: OwnResult[]): TeamGameRecord[] {
  const detail = (m: OwnResult) =>
    `${m.own_side === "away" ? "@" : "vs"} ${m.opponent_name ?? "?"} ${m.own_score}-${m.opponent_score} · ${m.match_date?.split("-").reverse().join("/") ?? ""}`;
  const best = (score: (m: OwnResult) => number, list = results) =>
    [...list].sort((a, b) => score(b) - score(a) || (a.match_date ?? "").localeCompare(b.match_date ?? ""))[0];
  const out: TeamGameRecord[] = [];
  const most = best((m) => m.own_score);
  if (most) out.push({ label: "Più punti segnati", value: String(most.own_score), matchId: most.id, detail: detail(most) });
  const wins = results.filter((m) => m.own_score > m.opponent_score);
  const widest = best((m) => m.own_score - m.opponent_score, wins);
  if (widest) out.push({ label: "Vittoria più larga", value: `+${widest.own_score - widest.opponent_score}`, matchId: widest.id, detail: detail(widest) });
  const fewest = best((m) => -m.opponent_score);
  if (fewest) out.push({ label: "Meno punti subiti", value: String(fewest.opponent_score), matchId: fewest.id, detail: detail(fewest) });
  return out;
}
