import { describe, expect, it } from "vitest";
import { contextSplits, summarize, type GameLineLike } from "../src/lib/domain/player";

const line = (over: Partial<GameLineLike>): GameLineLike => ({
  participation: "played", own_side: "home", own_result: "W", competition_kind: "regular_season",
  points: 10, reb: 4, ast: 2, fgm: 4, fga: 8, fg3m: 1, fg3a: 3, ftm: 1, fta: 2, ...over,
});

describe("statistiche per contesto", () => {
  it("calcola le medie solo sulle partite in cui la statistica esiste", () => {
    const s = summarize([line({ reb: null }), line({ points: 20, reb: 6 }), line({ participation: "dnp", points: null })]);
    expect(s.games).toBe(2);
    expect(s.ppg).toBe(15);
    expect(s.rpg).toBe(6);
    expect(s.fgPct).toBeCloseTo(0.5);
  });

  it("divide casa/trasferta, vittorie/sconfitte e fasi, senza contesti vuoti", () => {
    const splits = contextSplits([line({}), line({ own_side: "away", own_result: "L", points: 4, competition_kind: "playoff" })]);
    const byKey = Object.fromEntries(splits.map((s) => [s.key, s.summary]));
    expect(byKey.home.ppg).toBe(10);
    expect(byKey.away.ppg).toBe(4);
    expect(byKey.loss.games).toBe(1);
    expect(byKey.poule).toBeUndefined();
  });
});
