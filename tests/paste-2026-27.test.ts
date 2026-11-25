import { describe, expect, it } from "vitest";
import { planPaste } from "@/lib/domain/paste";

// Turni 2026-27 decisi con la squadra: 3 per mese da dicembre a maggio, vicino al compleanno
// per chi lo compie in stagione. Controlla che ognuno cada proprio nel suo allenamento.
const setup = {
  start: "2026-09-01",
  end: "2027-05-31",
  weekdays: [1, 4],
  breaks: [
    { start: "2026-12-24", end: "2027-01-06", label: "Natale" },
    { start: "2027-03-25", end: "2027-03-30", label: "Pasqua" },
  ],
  matchDays: ["2026-11-02", "2026-11-11", "2026-11-16", "2026-11-24", "2026-11-30", "2026-12-03", "2026-12-11", "2026-12-14", "2027-01-16", "2027-01-20", "2027-01-25", "2027-02-03", "2027-02-08", "2027-02-18", "2027-02-22", "2027-03-05", "2027-03-08", "2027-03-15"],
};
const turns: [string, string][] = [
  ["Cassa", "10-25"], ["Chicco", "11-22"],
  ["Teo", "12-07"], ["Peppo", "12-10"], ["Speedy", "12-17"],
  ["Pony", "01-07"], ["King", "01-14"], ["Simo", "01-21"],
  ["Bertuz", "02-04"], ["Sammy", "02-15"], ["Macca", "02-25"],
  ["Biolco", "03-04"], ["Giamma", "03-11"], ["Dede", "03-22"],
  ["Triso", "04-05"], ["J", "04-15"], ["Cesare", "04-26"],
  ["Caro", "05-06"], ["Aleandro", "05-17"], ["Marçelo", "05-27"],
];

describe("turni delle paste 2026-27", () => {
  it("ognuno nel giorno scelto, 3 al mese da dicembre a maggio", () => {
    const plan = planPaste(turns.map(([n, d]) => ({ id: n, name: n, birthDate: null, pasteDay: d })), setup);
    const days = Object.fromEntries(plan.slots.map((s) => [s.name, s.day.slice(5)]));
    for (const [n, d] of turns.slice(2)) expect(days[n], n).toBe(d);
    const perMonth: Record<string, number> = {};
    for (const s of plan.slots) if (s.day >= "2026-12-01") perMonth[s.day.slice(0, 7)] = (perMonth[s.day.slice(0, 7)] ?? 0) + 1;
    expect(Object.values(perMonth)).toEqual([3, 3, 3, 3, 3, 3]);
  });
});
