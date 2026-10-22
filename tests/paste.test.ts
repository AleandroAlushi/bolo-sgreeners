import { describe, expect, it } from "vitest";
import { planPaste, trainingDays, type PastePerson, type TrainingSetup } from "../src/lib/domain/paste";

const setup: TrainingSetup = {
  start: "2026-09-07", // lunedì
  end: "2026-10-04",
  weekdays: [1, 4],
  breaks: [{ start: "2026-09-21", end: "2026-09-27", label: "Pausa" }],
};
const p = (id: string, birthDate: string | null): PastePerson => ({ id, name: id, birthDate });

describe("calendario delle paste", () => {
  it("allenamenti lunedì e giovedì, saltando le pause", () => {
    expect(trainingDays(setup)).toEqual(["2026-09-07", "2026-09-10", "2026-09-14", "2026-09-17", "2026-09-28", "2026-10-01"]);
  });

  it("il compleanno porta le paste al primo allenamento utile", () => {
    const weeks = planPaste([p("anna", "1995-09-08")], setup);
    expect(weeks[0].assignments[0]).toMatchObject({ personId: "anna", day: "2026-09-10", reason: "birthday" });
  });

  it("ogni settimana ha almeno una pasta, con turni a chi ne ha portate meno", () => {
    const weeks = planPaste([p("anna", "1995-09-08"), p("bruno", null), p("carlo", "1990-12-25")], setup);
    expect(weeks).toHaveLength(3);
    for (const w of weeks) expect(w.assignments.length).toBeGreaterThan(0);
    const turns = weeks.flatMap((w) => w.assignments).filter((a) => a.reason !== "birthday");
    expect(new Set(turns.map((a) => a.personId)).size).toBe(turns.length);
  });

  it("chi compie gli anni durante una pausa porta le paste al rientro", () => {
    const back = planPaste([p("dario", "1998-09-23")], setup)
      .flatMap((w) => w.assignments)
      .find((a) => a.reason === "birthday");
    expect(back).toMatchObject({ day: "2026-09-28", reason: "birthday" });
  });

  it("compleanno lontano da ogni allenamento: recupero nella prima settimana libera dopo", () => {
    const weeks = planPaste([p("dario", "1998-09-19"), p("ezio", "1990-09-14")], { ...setup, breaks: [{ start: "2026-09-18", end: "2026-09-30", label: "Pausa" }] });
    const a = weeks.flatMap((w) => w.assignments).find((x) => x.reason === "recovered");
    expect(a?.day).toBe("2026-10-01");
  });

  it("nei turni la stessa persona non capita in due settimane di fila", () => {
    const people = ["a", "b", "c", "d", "e", "f"].map((id, i) => p(id, i < 2 ? `1990-0${i + 1}-1${i}` : null));
    const weeks = planPaste(people, { start: "2026-09-07", end: "2027-03-28", weekdays: [1, 4], breaks: [] });
    for (let i = 1; i < weeks.length; i++) {
      const prev = new Set(weeks[i - 1].assignments.map((a) => a.personId));
      for (const a of weeks[i].assignments.filter((x) => x.reason === "turn")) expect(prev.has(a.personId)).toBe(false);
    }
  });
});
