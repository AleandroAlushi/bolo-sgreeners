import { describe, expect, it } from "vitest";
import { sumTotalsBy, type TotalsRow } from "../src/lib/domain/stats";

describe("somma dei totali per fase", () => {
  it("somma colonne e partite registrate, tenendo separati giocatori e fasi", () => {
    const rows: TotalsRow[] = [
      { player_id: "a", competition_id: "rs1", games: 10, points: 100, reb: null, reb_games: 0 },
      { player_id: "a", competition_id: "rs2", games: 5, points: 40, reb: 20, reb_games: 5 },
      { player_id: "a", competition_id: "po1", games: 2, points: 30, reb: 8, reb_games: 2 },
      { player_id: "b", competition_id: "rs1", games: 1, points: null, reb: null, reb_games: 0 },
    ];
    const kind = (r: TotalsRow) => (String(r.competition_id).startsWith("rs") ? "regular_season" : "playoff");
    const out = sumTotalsBy(rows, kind);
    const a = out.find((r) => r.player_id === "a" && r.group === "regular_season")!;
    expect(a.games).toBe(15);
    expect(a.points).toBe(140);
    expect(a.reb).toBe(20);
    expect(a.reb_games).toBe(5);
    expect(out.find((r) => r.player_id === "a" && r.group === "playoff")!.points).toBe(30);
    expect(out.find((r) => r.player_id === "b")!.points).toBeUndefined();
  });
});
