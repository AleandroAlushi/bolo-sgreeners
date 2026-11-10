import { describe, expect, it } from "vitest";
import { postCaption, preCaption, statLine, when, type CaptionPlayer, type PostCaptionInput } from "@/lib/graphics/social/caption";
import { mvpScore, shortDay, teamCode } from "@/lib/graphics/social/format";

const p = (name: string, instagram: string | null, pts: number, reb = 0, ast = 0, stl = 0, blk = 0): CaptionPlayer => ({ name, instagram, pts, reb, ast, stl, blk });

const carini = p("Francesco Carini", "francescocariniii", 12, 4, 3, 3);
const base: PostCaptionInput = {
  ownScore: 71,
  oppScore: 42,
  home: true,
  opponent: "Polisportiva Trottola Porretta",
  date: "2026-11-02",
  wins: 1,
  losses: 0,
  firstGame: true,
  firstOfKind: true,
  streak: 1,
  mvp: carini,
  mvpCount: 1,
  players: [carini, p("Matteo Mazzanti", null, 11, 15), p("Simone Venturi", null, 10, 4, 3, 4)],
  next: { date: "2026-11-04", home: false, opponent: "Hoopless", firstOfKind: true },
};

describe("didascalia dopo la partita", () => {
  it("segue lo stile dei post: titolo, record, MVP con tag, prossima partita", () => {
    const text = postCaption(base);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Buona la prima ✅");
    expect(lines[1]).toBe("1-0");
    expect(lines[2]).toBe("Primo #mvp del match per @francescocariniii");
    expect(lines[3]).toContain("Successo largo contro Polisportiva Trottola Porretta (71-42).");
    expect(lines[3]).toContain("Francesco Carini: 12 punti, 4 rimbalzi, 3 assist e 3 recuperi.");
    expect(lines[3]).toContain("Doppia doppia per Matteo Mazzanti (11 punti e 15 rimbalzi).");
    expect(lines[4]).toBe("Vi aspettiamo mercoledì per la prima trasferta della stagione!");
    expect(lines.at(-1)).toBe("#bolosgreeners");
  });

  it("prima in casa, serie di vittorie, sconfitte di misura", () => {
    expect(postCaption({ ...base, firstGame: false }).split("\n")[0]).toBe("Buona la prima in casa ✅");
    expect(postCaption({ ...base, firstGame: false, firstOfKind: false, streak: 3, home: false }).split("\n")[0]).toBe("Terza vittoria di fila ✅");
    const loss = postCaption({ ...base, ownScore: 60, oppScore: 63, firstGame: false, firstOfKind: false, home: false, wins: 1, losses: 1 });
    expect(loss.split("\n")[0]).toBe("Sconfitta di misura in trasferta");
    expect(loss.split("\n")[1]).toBe("1-1");
  });

  it("MVP senza profilo Instagram: il nome; MVP ripetuti contati", () => {
    const text = postCaption({ ...base, mvp: { ...carini, instagram: null }, mvpCount: 2 });
    expect(text).toContain("Secondo #mvp stagionale per Francesco Carini");
  });

  it("prossima partita lontana o in casa", () => {
    expect(postCaption({ ...base, next: { date: "2026-11-20", home: true, opponent: "Hoopless", firstOfKind: false } })).toContain(
      "Vi aspettiamo venerdì 20 novembre in casa contro Hoopless!",
    );
    expect(postCaption({ ...base, next: null })).not.toContain("Vi aspettiamo");
  });
});

describe("aiuti", () => {
  it("statistiche a parole, senza gli zeri", () => {
    expect(statLine(p("X", null, 1, 0, 1))).toBe("1 punto e 1 assist");
    expect(statLine(p("X", null, 0))).toBe("");
  });
  it("giorni relativi", () => {
    expect(when("2026-11-03", "2026-11-02")).toBe("domani");
    expect(when("2026-11-04", "2026-11-02")).toBe("mercoledì");
    expect(when("2026-11-12", "2026-11-02")).toBe("giovedì 12 novembre");
  });
  it("data corta delle grafiche e sigla delle squadre", () => {
    expect(shortDay("2026-11-02")).toBe("LUN 2.11");
    expect(teamCode("Polisportiva Trottola Porretta")).toBe("TRO");
    expect(teamCode("A.S.D. Basket Hoopless")).toBe("HOO");
  });
  it("valutazione per l'MVP", () => {
    expect(mvpScore({ points: 12, reb: 4, ast: 3, stl: 3, blk: 0, fga: 10, fgm: 5, fta: 2, ftm: 2, tov: 1 })).toBe(16);
  });
  it("didascalia della presentazione", () => {
    expect(preCaption({ opponent: "Hoopless", home: false, date: "2026-11-11", time: "21:30:00", venue: "PalaHoop" })).toBe(
      "Game day 🏀\nBolo Sgreeners in trasferta contro Hoopless\nMercoledì 11 novembre, ore 21:30\n📍 PalaHoop\nForza Sgreeners!\n#bolosgreeners",
    );
  });
});

describe("doppia doppia dell'MVP", () => {
  it("la cita nella frase dell'MVP", () => {
    const mazzanti = p("Matteo Mazzanti", null, 10, 12, 0, 1);
    const text = postCaption({ ...base, mvp: mazzanti, players: [mazzanti] });
    expect(text).toContain("Doppia doppia per Matteo Mazzanti: 10 punti, 12 rimbalzi e 1 recupero.");
  });
});
