/**
 * Statistiche del singolo giocatore per contesto (casa/trasferta, vittorie/sconfitte, fase).
 * Logica pura: le medie usano solo le partite in cui la statistica è registrata (null ≠ 0).
 */
export interface GameLineLike {
  participation: string | null;
  own_side: string | null;
  own_result: string | null;
  competition_kind: string | null;
  points: number | null;
  reb: number | null;
  ast: number | null;
  fgm: number | null;
  fga: number | null;
  fg3m: number | null;
  fg3a: number | null;
  ftm: number | null;
  fta: number | null;
}

export interface SplitSummary {
  games: number;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
}

const perGame = (lines: GameLineLike[], key: "points" | "reb" | "ast") => {
  const values = lines.map((l) => l[key]).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, v) => a + v, 0) / values.length : null;
};

const pct = (lines: GameLineLike[], made: "fgm" | "fg3m" | "ftm", att: "fga" | "fg3a" | "fta") => {
  const rows = lines.filter((l) => l[made] !== null && l[att] !== null);
  const a = rows.reduce((s, l) => s + (l[att] ?? 0), 0);
  return a > 0 ? rows.reduce((s, l) => s + (l[made] ?? 0), 0) / a : null;
};

export function summarize(lines: GameLineLike[]): SplitSummary {
  const played = lines.filter((l) => l.participation === "played");
  return {
    games: played.length,
    ppg: perGame(played, "points"),
    rpg: perGame(played, "reb"),
    apg: perGame(played, "ast"),
    fgPct: pct(played, "fgm", "fga"),
    fg3Pct: pct(played, "fg3m", "fg3a"),
    ftPct: pct(played, "ftm", "fta"),
  };
}

const CONTEXTS: { key: string; label: string; group: string; test: (l: GameLineLike) => boolean }[] = [
  { key: "home", label: "In casa", group: "Campo", test: (l) => l.own_side === "home" },
  { key: "away", label: "In trasferta", group: "Campo", test: (l) => l.own_side === "away" },
  { key: "win", label: "Vittorie", group: "Risultato", test: (l) => l.own_result === "W" },
  { key: "loss", label: "Sconfitte", group: "Risultato", test: (l) => l.own_result === "L" },
  { key: "regular", label: "Regular season", group: "Fase", test: (l) => l.competition_kind === "regular_season" },
  { key: "poule", label: "Poule", group: "Fase", test: (l) => l.competition_kind === "poule" },
  { key: "playoff", label: "Playoff", group: "Fase", test: (l) => l.competition_kind === "playoff" },
];

/** Rendimento diviso per contesto; i contesti senza partite non compaiono. */
export function contextSplits(lines: GameLineLike[]) {
  return CONTEXTS.map((c) => ({ ...c, summary: summarize(lines.filter(c.test)) })).filter((c) => c.summary.games > 0);
}
