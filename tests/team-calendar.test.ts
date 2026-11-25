import { describe, expect, it } from "vitest";
import { addMinutes, buildTeamCalendar } from "@/lib/domain/team-calendar";

const setup = {
  start: "2026-12-01",
  end: "2026-12-31",
  weekdays: [1, 4],
  breaks: [{ start: "2026-12-23", end: "2027-01-07", label: "Vacanze di Natale" }],
  matchDays: ["2026-12-14"],
};
const times: Record<string, [string, string]> = { "1": ["22:00", "23:30"], "4": ["21:30", "23:00"] };

describe("calendario della squadra", () => {
  it("una partita dura un'ora e mezza", () => {
    expect(addMinutes("22:15", 90)).toBe("23:45");
    expect(addMinutes("23:00", 90)).toBe("00:30");
  });

  it("allenamenti con orario, partite, auguri, paste e pause", () => {
    const events = buildTeamCalendar({
      setup,
      times,
      matches: [{ id: "m1", date: "2026-12-14", time: "22:15", opponent: "San Biagio", home: true, venue: "Palestra" }],
      people: [{ id: "p:teo", name: "Matteo Mazzanti", short: "Teo", birthDate: "1999-12-06" }],
      slots: [{ personId: "p:teo", name: "Matteo Mazzanti", day: "2026-12-07", target: "2026-12-07", done: false }],
    });
    const on = (d: string) => events.filter((e) => e.date === d).map((e) => [e.kind, e.title, e.time ?? ""]);
    expect(on("2026-12-03")).toEqual([["training", "Allenamento", "21:30–23:00"]]);
    expect(on("2026-12-06")).toEqual([["birthday", "Auguri Teo! 🎂", ""]]);
    expect(on("2026-12-07")).toEqual([
      ["training", "Allenamento", "22:00–23:30"],
      ["paste", "Paste: Teo", ""],
    ]);
    // giorno di partita: niente allenamento
    expect(on("2026-12-14")).toEqual([["match", "vs San Biagio", "22:15–23:45"]]);
    // pausa: niente allenamento, solo la pausa (fino a fine stagione)
    expect(on("2026-12-24")).toEqual([["break", "Vacanze di Natale", ""]]);
    expect(events.some((e) => e.date > "2026-12-31")).toBe(false);
  });
});
