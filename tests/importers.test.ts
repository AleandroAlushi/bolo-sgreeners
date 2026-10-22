import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMatchReportPayload,
  mapPlayers,
  matchPlayerAlias,
  normalizePlayerName,
  parseJerseyLabel,
  parseMatchDate,
  parseMatchHtml,
  validateImportedMatch,
  type AliasRecord,
} from "../src/lib/importers";
import { extractEasyStats } from "../src/lib/importers/easystats/extract";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");
const opts = { ownTeamNames: ["Demo Home"] };

describe("normalizzazione", () => {
  it("interpreta date in inglese e italiano", () => {
    expect(parseMatchDate("14 Feb 2024")).toBe("2024-02-14");
    expect(parseMatchDate("21 ott 2025")).toBe("2025-10-21");
    expect(parseMatchDate("6 giu 2025")).toBe("2025-06-06");
    expect(parseMatchDate("31/01/2025")).toBe("2025-01-31");
    expect(parseMatchDate("boh")).toBeNull();
  });

  it("distingue #0 da #00", () => {
    expect(parseJerseyLabel("#00 Triso")).toEqual({ jersey: "00", name: "Triso" });
    expect(parseJerseyLabel("#0 Fede")).toEqual({ jersey: "0", name: "Fede" });
  });

  it("normalizza accenti e maiuscole", () => {
    expect(normalizePlayerName("Marçelo")).toBe("marcelo");
    expect(normalizePlayerName("  BILKS ")).toBe("bilks");
  });
});

describe("parser Easy Stats", () => {
  it("formato legacy a 14 colonne", () => {
    const raw = extractEasyStats(fixture("easystats-legacy.html"));
    expect(raw.formatVariant).toBe("legacy-14col");
    expect(raw.left).toMatchObject({ name: "Demo Home", score: 50, appSide: "away" });
    expect(raw.playerRows).toHaveLength(3);
    expect(raw.teamRows).toHaveLength(2);

    const r = parseMatchHtml(fixture("easystats-legacy.html"), opts);
    expect(r.date).toBe("2024-02-14");
    expect(r.own.score).toBe(50);
    expect(r.opponent.score).toBe(48);
    const alfa = r.players[0];
    expect(alfa.stats).toMatchObject({ fgm: 8, fga: 13, fg3m: 2, fg3a: 4, ftm: 3, fta: 6, oreb: 3, dreb: 2, reb: 5, pf: 1, stl: 5, tov: 4, blk: 3, ast: 1, plus_minus: 12, minutes: 20, points: 21 });
    // 0 minuti e tutti zeri: a referto ma non entrato
    expect(r.players[2].participation).toBe("dnp");
    expect(validateImportedMatch(r).filter((i) => i.level !== "info")).toEqual([]);
  });

  it("formato con percentuali, assenti e parziali per quarto", () => {
    const r = parseMatchHtml(fixture("easystats-pct.html"), opts);
    expect(r.formatVariant).toBe("pct-17col");
    expect(r.date).toBe("2026-04-23");
    // la nostra squadra è a destra ("home" per l'app)
    expect(r.own).toMatchObject({ rawName: "Demo Home", score: 55, appSide: "home" });
    expect(r.players[1].participation).toBe("absent");
    expect(r.periods).toEqual([
      { period: 1, label: "Q1", own: 21, opponent: 10 },
      { period: 2, label: "Q2", own: 10, opponent: 10 },
      { period: 3, label: "Q3", own: 15, opponent: 11 },
      { period: 4, label: "Q4", own: 9, opponent: 10 },
    ]);
    expect(r.opponent.totals?.points).toBe(41);
  });

  it("segnala il conflitto con il risultato ufficiale", () => {
    const r = parseMatchHtml(fixture("easystats-legacy.html"), opts);
    const issues = validateImportedMatch(r, { officialScore: { own: 52, opponent: 48 } });
    expect(issues.map((i) => i.code)).toContain("official_score_conflict");
  });

  it("rifiuta file non riconosciuti", () => {
    expect(() => parseMatchHtml("<html><body>ciao</body></html>", opts)).toThrow(/non riconosciuto/);
  });

  it("errore se la nostra squadra non è riconoscibile", () => {
    const r = parseMatchHtml(fixture("easystats-legacy.html"), { ownTeamNames: ["Altra"] });
    expect(r.issues.map((i) => i.code)).toContain("own_team_not_identified");
  });
});

describe("mapping alias", () => {
  const aliases: AliasRecord[] = [
    { playerId: "hrvatin", alias: "Chicco", seasonId: null, jersey: "32" },
    { playerId: "carini", alias: "Chicco", seasonId: null, jersey: "2" },
    { playerId: "carini", alias: "Caro", seasonId: null, jersey: null },
    { playerId: "luca-a", alias: "Luca", seasonId: "2024-25", jersey: null },
    { playerId: "luca-b", alias: "Luca", seasonId: null, jersey: null },
    { playerId: "x", alias: "Dup", seasonId: null, jersey: null },
    { playerId: "y", alias: "Dup", seasonId: null, jersey: null },
  ];
  const players = [{ id: "curati", displayName: "Luca Curati" }];

  it("usa il numero di maglia per gli alias condizionali", () => {
    expect(matchPlayerAlias({ rawLabel: "#32 Chicco", name: "Chicco", jersey: "32" }, aliases, players, null).playerId).toBe("hrvatin");
    expect(matchPlayerAlias({ rawLabel: "#2 Chicco", name: "Chicco", jersey: "2" }, aliases, players, null).playerId).toBe("carini");
    expect(matchPlayerAlias({ rawLabel: "Chicco", name: "Chicco", jersey: null }, aliases, players, null).status).toBe("unmatched");
  });

  it("preferisce l'alias limitato alla stagione", () => {
    expect(matchPlayerAlias({ rawLabel: "Luca", name: "Luca", jersey: null }, aliases, players, "2024-25").playerId).toBe("luca-a");
    expect(matchPlayerAlias({ rawLabel: "Luca", name: "Luca", jersey: null }, aliases, players, "2025-26").playerId).toBe("luca-b");
  });

  it("segnala gli alias ambigui e i nomi sconosciuti", () => {
    expect(matchPlayerAlias({ rawLabel: "Dup", name: "Dup", jersey: null }, aliases, players, null).status).toBe("ambiguous");
    expect(matchPlayerAlias({ rawLabel: "Nuovo", name: "Nuovo", jersey: null }, aliases, players, null).status).toBe("unmatched");
    expect(matchPlayerAlias({ rawLabel: "luca curati", name: "luca curati", jersey: null }, aliases, players, null).playerId).toBe("curati");
  });

  it("non assegna due righe allo stesso giocatore", () => {
    const res = mapPlayers(
      [
        { rawLabel: "#2 Caro", name: "Caro", jersey: "2" },
        { rawLabel: "#2 Chicco", name: "Chicco", jersey: "2" },
      ],
      aliases,
      players,
      null,
    );
    expect(res.every((m) => m.status === "ambiguous")).toBe(true);
  });
});

describe("payload di persistenza", () => {
  it("esclude gli assenti e include i totali di entrambe le squadre", () => {
    const report = parseMatchHtml(fixture("easystats-pct.html"), opts);
    const mappings = report.players.map((p) => ({ rawLabel: p.rawLabel, name: p.name, jersey: p.jersey, status: "matched" as const, playerId: p.name, candidates: [], reason: "" }));
    const payload = buildMatchReportPayload({
      matchId: "m", ownTeamId: "t", seasonId: null, report, mappings,
      file: { name: "f.html", hash: "h", size: 1, storagePath: null },
      source: { kind: "html", label: "test" }, issues: [], overwrite: false,
    });
    expect(payload.player_stats).toHaveLength(1);
    expect(payload.team_stats.map((t) => t && t.side)).toEqual(["own", "opponent"]);
    expect(payload.result).toEqual({ own: 55, opponent: 41 });
    expect(payload.periods).toHaveLength(4);
  });
});
