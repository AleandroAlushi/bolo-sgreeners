import { describe, expect, it } from "vitest";
import { compareStandings, computeStandings, isCalendarComplete, type StandingsMatch } from "../src/lib/domain/standings";
import { buildLeaderboard, formatStat, per30, qualifies, statValue, type StatDefinition } from "../src/lib/domain/stats";

const teams = ["A", "B", "C"].map((t) => ({ team_id: t, name: t, is_own_team: t === "A" }));
const m = (h: string, a: string, hs: number, as: number, periods = 4): StandingsMatch => ({
  home_team_id: h,
  away_team_id: a,
  home_score: hs,
  away_score: as,
  status: "played",
  periods_recorded: periods,
});
const rule = { points_win: 3, points_loss: 0, points_ot_win: null, points_ot_loss: 1, points_forfeit_win: null, points_forfeit_loss: null, tiebreakers: ["points", "head_to_head", "point_diff"] };

describe("classifica calcolata", () => {
  it("assegna i punti secondo la configurazione (anche ai supplementari)", () => {
    const rows = computeStandings(teams, [m("A", "B", 60, 50), m("B", "C", 70, 68, 5), m("C", "A", 55, 50)], rule);
    const byId = Object.fromEntries(rows.map((r) => [r.team_id, r]));
    expect(byId.A.points).toBe(3);
    expect(byId.B.points).toBe(3);
    expect(byId.C.points).toBe(4); // sconfitta ai supplementari = 1 punto
    expect(byId.C.ot_losses).toBe(1);
    expect(rows[0].team_id).toBe("C");
  });

  it("risolve la parità con la classifica avulsa", () => {
    // parità circolare a 3 punti: decide la differenza punti negli scontri diretti
    const rows = computeStandings(teams, [m("A", "B", 51, 50), m("B", "C", 90, 40), m("C", "A", 60, 40)], rule);
    expect(rows.map((r) => r.team_id)).toEqual(["B", "A", "C"]);
  });

  it("con due squadre a pari punti vince chi ha vinto lo scontro diretto", () => {
    const four = [...teams, { team_id: "D", name: "D", is_own_team: false }];
    // A e B a 6 punti; A ha battuto B pur avendo differenza punti totale peggiore
    const rows = computeStandings(four, [m("A", "B", 51, 50), m("B", "C", 90, 40), m("B", "D", 90, 40), m("A", "C", 50, 49), m("D", "A", 70, 40), m("C", "D", 60, 50)], rule);
    const order = rows.map((r) => r.team_id);
    expect(order.slice(0, 2)).toEqual(["A", "B"]);
  });

  it("applica le penalizzazioni", () => {
    const rows = computeStandings(teams, [m("A", "B", 60, 50)], rule, new Map([["A", -1]]));
    expect(rows.find((r) => r.team_id === "A")!.points).toBe(2);
  });

  it("segnala le differenze con la classifica ufficiale senza correggerle", () => {
    const rows = computeStandings(teams, [m("A", "B", 60, 50)], rule);
    const diff = compareStandings(rows, [{ team_id: "A", position: 1, played: 1, wins: 1, losses: 0, points: 3, points_for: 62, points_against: 50 }]);
    expect(diff).toEqual([{ team_id: "A", field: "points_for", official: 62, computed: 60 }]);
  });

  it("riconosce un calendario incompleto", () => {
    const rows = computeStandings(teams, [m("A", "B", 60, 50)], rule);
    expect(isCalendarComplete(rows, [], [m("A", "B", 60, 50)], "A")).toBe(false);
    expect(isCalendarComplete(rows, [], [m("A", "B", 60, 50), m("B", "C", 1, 2)], "A")).toBe(true);
  });
});

const def = (over: Partial<StatDefinition>): StatDefinition => ({
  key: "x", label: "X", short_label: "X", description: null, category: "scoring", kind: "total", column_name: "points",
  numerator_column: null, denominator_column: null, decimals: 0, higher_is_better: true, show_in_leaderboards: true,
  show_in_box_score: false, min_games: 0, min_attempts: 0, min_minutes: 0, sort_order: 1, ...over,
});

describe("leaderboard", () => {
  const rows = [
    { player_id: "p1", games: 10, points: 100, points_games: 10, fg3m: 1, fg3a: 1 },
    { player_id: "p2", games: 2, points: 40, points_games: 2, fg3m: 20, fg3a: 50 },
    { player_id: "p3", games: 10, points: 100, points_games: 8, fg3m: 0, fg3a: 0 },
  ];

  it("calcola le medie sulle sole partite in cui la statistica è registrata", () => {
    expect(statValue(def({ kind: "per_game" }), rows[2])).toBeCloseTo(12.5);
  });

  it("rispetta le soglie minime", () => {
    const ppg = def({ kind: "per_game", min_games: 4 });
    expect(qualifies(ppg, rows[1])).toBe(false);
    const pct = def({ kind: "percentage", column_name: null, numerator_column: "fg3m", denominator_column: "fg3a", min_attempts: 10 });
    const board = buildLeaderboard(pct, rows);
    expect(board.map((e) => e.playerId)).toEqual(["p2"]); // l'1/1 di p1 non vale il primo posto
  });

  it("gestisce i pari merito", () => {
    const board = buildLeaderboard(def({}), rows);
    expect(board.slice(0, 2).map((e) => e.rank)).toEqual([1, 1]);
    expect(board[2].rank).toBe(3);
  });
});

describe("statistiche per 30 minuti", () => {
  // p1: 40 punti in 60' (più 6 punti in una gara senza minuti, che non contano)
  const p1 = { player_id: "p1", games: 5, minutes: 60, minutes_games: 4, points: 46, points_on_min: 40, points_min: 60 };
  // p2: tanti punti in pochissimi minuti
  const p2 = { player_id: "p2", games: 5, minutes: 20, minutes_games: 5, points: 20, points_on_min: 20, points_min: 20 };
  const pts30 = def({ kind: "per_30", decimals: 1, min_games: 4, min_minutes: 50 });

  it("normalizza sui minuti delle sole partite con i minuti registrati", () => {
    expect(per30(p1, "points")).toBeCloseTo(20);
    expect(statValue(pts30, p1)).toBeCloseTo(20);
    expect(formatStat(pts30, 20)).toBe("20,0");
  });

  it("esclude dalla classifica chi ha giocato pochi minuti", () => {
    expect(per30(p2, "points")).toBeCloseTo(30);
    const board = buildLeaderboard(pts30, [p1, p2]);
    expect(board.map((e) => [e.playerId, e.detail])).toEqual([["p1", "60 min"]]);
  });
});
