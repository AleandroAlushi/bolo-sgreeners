import { describe, expect, it } from "vitest";
import { planPaste, seasonDate, trainingDays, type PastePerson, type TrainingSetup } from "../src/lib/domain/paste";

const setup: TrainingSetup = {
  start: "2026-09-07", // lunedì
  end: "2027-01-31",
  weekdays: [1, 4],
  breaks: [{ start: "2026-12-23", end: "2027-01-07", label: "Vacanze di Natale" }],
  matchDays: ["2026-10-08"], // giovedì con partita
};
const p = (id: string, pasteDay: string | null, extra: Partial<PastePerson> = {}): PastePerson => ({ id, name: id, birthDate: null, pasteDay, ...extra });

describe("calendario delle paste", () => {
  it("allenamenti lunedì e giovedì, senza pause né giorni di partita", () => {
    const days = trainingDays(setup);
    expect(days.slice(0, 4)).toEqual(["2026-09-07", "2026-09-10", "2026-09-14", "2026-09-17"]);
    expect(days).not.toContain("2026-10-08");
    expect(days.some((d) => d >= "2026-12-23" && d <= "2027-01-07")).toBe(false);
  });

  it("il giorno e mese diventa la data della stagione", () => {
    expect(seasonDate("10-04", setup)).toBe("2026-10-04");
    expect(seasonDate("01-15", setup)).toBe("2027-01-15");
    expect(seasonDate("07-16", setup)).toBeNull();
  });

  it("ognuno porta le paste una volta, al primo allenamento utile dal suo giorno", () => {
    const plan = planPaste([p("bisca", "10-04"), p("jordan", "10-08")], setup);
    expect(plan.slots).toEqual([
      { personId: "bisca", name: "bisca", day: "2026-10-05", target: "2026-10-04" },
      // giovedì 8 c'è la partita: si passa al lunedì dopo
      { personId: "jordan", name: "jordan", day: "2026-10-12", target: "2026-10-08" },
    ]);
  });

  it("due persone sullo stesso allenamento: la seconda va al successivo", () => {
    const plan = planPaste([p("a", "11-02"), p("b", "11-02")], setup);
    expect(plan.slots.map((s) => s.day)).toEqual(["2026-11-02", "2026-11-05"]);
  });

  it("dopo la pausa si riprende al primo allenamento utile", () => {
    const plan = planPaste([p("natale", "12-24")], setup);
    expect(plan.slots[0].day).toBe("2027-01-11");
  });

  it("senza giorno è da impostare, chi è esentato non compare, fuori stagione non si piazza", () => {
    const plan = planPaste([p("nuovo", null), p("coach", "10-20", { exempt: true }), p("estate", "07-16")], setup);
    expect(plan.unassigned.map((x) => x.id)).toEqual(["nuovo"]);
    expect(plan.unplaced.map((x) => x.id)).toEqual(["estate"]);
    expect(plan.slots).toHaveLength(0);
    expect(plan.freeDays).toEqual(plan.trainingDays);
  });
});
