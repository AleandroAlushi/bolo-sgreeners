import { describe, expect, it } from "vitest";
import { clockNow, elapsed, summarize, type LiveEvent } from "../src/lib/live/engine";
import { buildLiveReport } from "../src/lib/live/report";
import { duePushes } from "../src/lib/push";

const roster = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ player_id: id, jersey: String(i + 1), name: id.toUpperCase() }));
let n = 0;
const ev = (e: Partial<LiveEvent> & Pick<LiveEvent, "kind">): LiveEvent => ({
  id: `e${++n}`,
  n,
  period: 1,
  clock: 600,
  team: "own",
  player_id: null,
  made: null,
  ...e,
});
const clock = { period: 1, periods: 4, periodSeconds: 600, remaining: 0 };

describe("partita in diretta", () => {
  it("conta il tempo di gioco tra i periodi", () => {
    expect(elapsed(1, 600, 4, 600)).toBe(0);
    expect(elapsed(2, 300, 4, 600)).toBe(900);
    expect(elapsed(5, 300, 4, 600)).toBe(2400); // supplementare da 5'
  });

  it("calcola l'orologio che scorre", () => {
    const at = new Date("2026-11-05T20:00:00Z");
    expect(clockNow({ clock_remaining: 600, clock_running: true, clock_updated_at: at.toISOString() }, at.getTime() + 65_000)).toBe(535);
    expect(clockNow({ clock_remaining: 600, clock_running: false, clock_updated_at: at.toISOString() }, at.getTime() + 65_000)).toBe(600);
  });

  it("ricostruisce punteggio, tabellino, minuti e +/-", () => {
    n = 0;
    const events = [
      ...["a", "b", "c", "d", "e"].map((id) => ev({ kind: "in", player_id: id })),
      ev({ kind: "2pt", player_id: "a", made: true, clock: 550 }),
      ev({ kind: "ast", player_id: "b", clock: 550 }),
      ev({ kind: "3pt", player_id: "c", made: false, clock: 500 }),
      ev({ kind: "dreb", team: "opp", clock: 495 }),
      ev({ kind: "3pt", team: "opp", made: true, clock: 480 }),
      // a esce a 5:00 (300 s), entra f
      ev({ kind: "out", player_id: "a", clock: 300 }),
      ev({ kind: "in", player_id: "f", clock: 300 }),
      ev({ kind: "1pt", player_id: "f", made: true, clock: 200 }),
      ev({ kind: "1pt", player_id: "f", made: false, clock: 200 }),
      ev({ kind: "foul", team: "opp", clock: 200 }),
    ];
    const s = summarize(events, roster, clock);
    expect(s.score).toEqual({ own: 3, opp: 3 });
    expect(s.periods).toEqual([{ own: 3, opp: 3 }]);
    const a = s.players.get("a")!;
    expect([a.points, a.fgm, a.fga, a.minutes, a.plus_minus]).toEqual([2, 1, 1, 5, -1]);
    const f = s.players.get("f")!;
    expect([f.points, f.ftm, f.fta, f.minutes, f.plus_minus]).toEqual([1, 1, 2, 5, 1]);
    expect(s.players.get("c")!.fg3a).toBe(1);
    expect(s.players.get("b")!.ast).toBe(1);
    expect(s.opponent.points).toBe(3);
    expect(s.opponent.dreb).toBe(1);
    expect(s.teamFouls).toEqual({ own: 0, opp: 1 });
    expect(s.timeline.map((p) => [p.own, p.opp])).toEqual([[0, 0], [2, 0], [2, 3], [3, 3]]);
  });

  it("diventa un box score come quello di Easy Stats", () => {
    n = 0;
    const events = [ev({ kind: "in", player_id: "a" }), ev({ kind: "2pt", player_id: "a", made: true, clock: 100 })];
    const { report, mappings } = buildLiveReport(
      { period: 1, periods: 4, period_seconds: 600, roster, opponent_name: "Hoopless" },
      events,
      { date: "2026-11-11", ownName: "Bolo Sgreeners", opponentName: "Hoopless" },
    );
    expect(report.own.score).toBe(2);
    expect(report.players[0].participation).toBe("played");
    expect(report.players[0].stats.minutes).toBe(10);
    expect(report.players[1].participation).toBe("dnp");
    expect(mappings.every((m) => m.status === "matched")).toBe(true);
  });
});


describe("notifiche push", () => {
  const m = { id: "m1", match_date: "2026-11-11", start_time: "21:15:00", opponent_name: "Hoopless", own_side: "away", venue_name: "Palestra Cervellati", own_score: null, opponent_score: null, status: "scheduled" };
  const at = (date: string, h: number, min = 0) => ({ date, minutes: h * 60 + min });
  it("il giorno della partita dalle 9, poi un'ora prima", () => {
    expect(duePushes(m, at("2026-11-11", 8, 50))).toEqual([]);
    expect(duePushes(m, at("2026-11-11", 9)).map((p) => p.kind)).toEqual(["giorno"]);
    expect(duePushes(m, at("2026-11-11", 20, 15)).map((p) => p.kind)).toEqual(["ora"]);
    expect(duePushes(m, at("2026-11-10", 20, 15))).toEqual([]);
  });
  it("il risultato finale, anche il giorno dopo", () => {
    const done = { ...m, own_score: 71, opponent_score: 42, status: "played" };
    expect(duePushes(done, at("2026-11-12", 9)).map((p) => [p.kind, p.title])).toEqual([["finale", "✅ Vittoria: Sgreeners 71–42"]]);
    expect(duePushes(done, at("2026-11-13", 9))).toEqual([]);
  });
});
