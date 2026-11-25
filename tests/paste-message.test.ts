import { describe, expect, it } from "vitest";
import { pasteDay, pasteMessage } from "@/lib/domain/paste-message";

describe("messaggio delle paste per WhatsApp", () => {
  it("date brevi con il giorno della settimana", () => {
    expect(pasteDay("2026-11-26")).toBe("gio 26/11");
  });

  it("mesi in grassetto, portate segnate e nota finale", () => {
    const text = pasteMessage({
      season: "2026-27",
      slots: [
        { personId: "a", name: "Federico Hrvatin", day: "2026-11-23", target: "2026-11-22", done: true },
        { personId: "b", name: "Luca Biolchini", day: "2026-11-26", target: "2026-11-26", done: false },
        { personId: "c", name: "Matteo Mazzanti", day: "2026-12-07", target: "2026-12-07", done: false },
      ],
      short: (id) => ({ a: "Chicco", b: "Biolco", c: "Teo" })[id] ?? "",
    });
    expect(text).toContain("🥐 *Turni delle paste 2026-27*");
    expect(text).toContain("*Novembre*\n✅ lun 23/11 · Chicco (portate)\n▫️ gio 26/11 · Biolco\n\n*Dicembre*\n▫️ lun 07/12 · Teo");
    expect(text).toContain("primo allenamento libero");
  });
});
