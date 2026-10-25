import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, googleCalendarUrl, mapLinks, type CalendarMatch } from "../src/lib/domain/ics";

const match = (over: Partial<CalendarMatch> = {}): CalendarMatch => ({
  id: "abc",
  date: "2026-10-27",
  time: "22:00:00",
  home: "Pallex - Jailbreakers",
  away: "Bolo Sgreeners",
  homeScore: null,
  awayScore: null,
  venue: "Centro Sportivo Cremonini",
  address: "Via Ghiarelle, 324, 41018 San Cesario sul Panaro MO",
  subtitle: "PCA Silver · 2ª giornata",
  url: "https://bolo-sgreeners.vercel.app/partite/abc",
  ...over,
});

describe("calendario .ics", () => {
  it("evento con orario di Roma, durata e luogo", () => {
    const ics = buildCalendar("Bolo Sgreeners 2026-27", [match()], new Date("2026-10-25T10:00:00Z"));
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DTSTART;TZID=Europe/Rome:20261027T220000");
    expect(unfolded).toContain("DTEND;TZID=Europe/Rome:20261027T234500");
    expect(unfolded).toContain("UID:abc@bolo-sgreeners");
    expect(unfolded).toContain("LOCATION:Centro Sportivo Cremonini\\, Via Ghiarelle\\, 324\\, 41018 San Cesario sul Panaro MO");
    expect(unfolded).toContain("BEGIN:VTIMEZONE");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("senza orario: tutto il giorno; senza data: niente evento; risultato nel titolo", () => {
    const ics = buildCalendar("x", [match({ time: null }), match({ id: "nodate", date: null }), match({ id: "played", homeScore: 41, awayScore: 55 })]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261027");
    expect(ics).toContain("DTEND;VALUE=DATE:20261028");
    expect(ics).not.toContain("nodate@");
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:🏀 Pallex - Jailbreakers - Bolo Sgreeners 41-55");
  });

  it("partita che finisce dopo mezzanotte", () => {
    const ics = buildCalendar("x", [match({ time: "22:45" })]).replace(/\r\n /g, "");
    expect(ics).toContain("DTEND;TZID=Europe/Rome:20261028T003000");
  });

  it("protegge i caratteri speciali e spezza le righe lunghe", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const folded = foldLine("X".repeat(200));
    expect(folded.split("\r\n ").join("")).toBe("X".repeat(200));
  });

  it("link per Google Calendar e per le mappe", () => {
    const url = new URL(googleCalendarUrl(match())!);
    expect(url.searchParams.get("dates")).toBe("20261027T220000/20261027T234500");
    expect(url.searchParams.get("ctz")).toBe("Europe/Rome");
    const maps = mapLinks("Centro Sportivo Cremonini", "Via Ghiarelle, 324")!;
    expect(maps.google).toContain("query=Centro%20Sportivo%20Cremonini%2C%20Via%20Ghiarelle%2C%20324");
    expect(maps.waze).toContain("navigate=yes");
    expect(maps.apple).toContain("maps.apple.com");
    expect(mapLinks(null, null)).toBeNull();
  });
});
