/**
 * Estrazione dei dati grezzi dai box score HTML esportati da "Easy Stats for Basketball".
 *
 * Formati reali osservati (vedi docs/DATI_IDENTIFICATI.md):
 *  - v1 "legacy-14col"  (2024): intestazione in una tabella separata #stats-hdr,
 *    colonne fg*, 3pt, ft, oreb, dreb, foul, stl, to, blk, asst, +/-, min, pts
 *  - v1 "legacy-12col"  (nov 2024): come sopra ma senza +/- e min, e senza righe totali squadra
 *  - v2 "pct-17col"     (2024-2026): intestazione dentro #stats, con colonne percentuali,
 *    giocatori non scesi in campo con tutte le celle "-", grafico "Game Flow" (immagine)
 *    e, in un caso, tabella #gameflow con i punti per quarto.
 *  - Alcuni export contengono anche gli shot chart (JS con ID interni dei giocatori).
 *
 * Questo modulo NON interpreta i numeri: restituisce stringhe, la normalizzazione è separata.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { RawBoxScore, RawShot, RawStatRow, RawTeamHeader } from "../types";

export const EASYSTATS_PARSER = "easystats-html";
export const EASYSTATS_PARSER_VERSION = "1.0.0";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Riconosce un export Easy Stats senza fare il parsing completo. */
export function isEasyStatsHtml(html: string): boolean {
  return /easy\s*stats/i.test(html) && /<table[^>]+id=['"]stats['"]/i.test(html);
}

const text = (el: HTMLElement | null | undefined): string =>
  (el?.text ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

function toIntOrNull(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function readTeamHeaders(root: HTMLElement): { left: RawTeamHeader; right: RawTeamHeader } {
  const leftScoreBox = root.querySelector("#team-score-left");
  const rightScoreBox = root.querySelector("#team-score-right");
  if (!leftScoreBox || !rightScoreBox) {
    throw new ExtractionError("Intestazione squadre non trovata", "missing_team_header");
  }

  // v1: nome e punteggio stanno nello stesso box; v2: nomi in #team-names-container
  let leftName = text(leftScoreBox.querySelector(".detail"));
  let rightName = text(rightScoreBox.querySelector(".detail"));
  const namesBox = root.querySelector("#team-names-container");
  if (namesBox) {
    leftName = text(namesBox.querySelector(".left .detail")) || leftName;
    rightName = text(namesBox.querySelector(".right .detail")) || rightName;
  }

  const logoSide = (selector: string): "away" | "home" | null => {
    const alt = root.querySelector(selector)?.getAttribute("alt") ?? "";
    if (/away/i.test(alt)) return "away";
    if (/home/i.test(alt)) return "home";
    return null;
  };

  return {
    left: {
      name: leftName,
      score: toIntOrNull(text(leftScoreBox.querySelector(".title"))),
      appSide: logoSide(".logo-container.left img") ?? "away",
    },
    right: {
      name: rightName,
      score: toIntOrNull(text(rightScoreBox.querySelector(".title"))),
      appSide: logoSide(".logo-container.right img") ?? "home",
    },
  };
}

function readColumns(root: HTMLElement): string[] {
  const headerCells =
    root.querySelectorAll("table#stats-hdr th").length > 0
      ? root.querySelectorAll("table#stats-hdr th")
      : root.querySelectorAll("table#stats tr th");
  return headerCells.slice(1).map((th) => text(th).toLowerCase());
}

function readRows(root: HTMLElement): RawStatRow[] {
  return root
    .querySelectorAll("table#stats tr")
    .map((tr) => tr.querySelectorAll("td").map((td) => text(td)))
    .filter((cells) => cells.length > 0)
    .map(([label, ...cells]) => ({ label: label ?? "", cells }));
}

function readPeriods(root: HTMLElement): RawBoxScore["periods"] {
  const rows = root.querySelectorAll("table#gameflow tr");
  if (rows.length < 3) return [];
  const labels = rows[0]
    .querySelectorAll("th")
    .map((th) => text(th))
    .filter((l) => l.length > 0);
  const leftCells = rows[1].querySelectorAll("td").slice(1).map(text);
  const rightCells = rows[2].querySelectorAll("td").slice(1).map(text);
  return labels.flatMap((label, i) => {
    const l = toIntOrNull(leftCells[i] ?? "");
    const r = toIntOrNull(rightCells[i] ?? "");
    return l === null || r === null ? [] : [{ label, left: l, right: r }];
  });
}

/** Legge le variabili JS `roster`, `homeplots`, `awayplots` degli export con shot chart. */
function readShotChartScript(html: string): Pick<RawBoxScore, "rosterIds" | "shots"> {
  const grab = (name: string): unknown => {
    const m = html.match(new RegExp(`let\\s+${name}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  };
  const roster = grab("roster");
  const rosterIds = Array.isArray(roster)
    ? roster
        .filter((r): r is [string, string] => Array.isArray(r) && r.length >= 2)
        .map(([label, id]) => ({ label: String(label), id: String(id) }))
    : [];

  const toShots = (plots: unknown): RawShot[] => {
    if (!Array.isArray(plots)) return [];
    return plots.flatMap((periodShots, periodIdx) =>
      Array.isArray(periodShots)
        ? periodShots
            .filter((s): s is [string, string, string, boolean] => Array.isArray(s) && s.length >= 4)
            .map(([playerRef, x, y, made]) => ({
              playerRef: String(playerRef),
              x: Number.parseFloat(String(x).replace(",", ".")),
              y: Number.parseFloat(String(y).replace(",", ".")),
              made: Boolean(made),
              period: periodIdx + 1,
            }))
        : [],
    );
  };
  // Nell'app "home" è la squadra a destra, "away" quella a sinistra.
  return { rosterIds, shots: { left: toShots(grab("awayplots")), right: toShots(grab("homeplots")) } };
}

const PLAYER_LABEL = /^#\s*\d+/;

export function extractEasyStats(html: string): RawBoxScore {
  if (!isEasyStatsHtml(html)) {
    throw new ExtractionError(
      "Il file non sembra un box score esportato da Easy Stats",
      "unsupported_format",
    );
  }
  const root = parse(html, { blockTextElements: { script: true, style: false } });
  const { left, right } = readTeamHeaders(root);
  const columns = readColumns(root);
  if (columns.length === 0) {
    throw new ExtractionError("Intestazione della tabella statistiche non trovata", "missing_columns");
  }

  const rows = readRows(root);
  const playerRows: RawStatRow[] = [];
  const teamRows: RawStatRow[] = [];
  for (const row of rows) {
    if (PLAYER_LABEL.test(row.label)) playerRows.push(row);
    else teamRows.push(row);
  }

  const hasPct = columns.some((c) => c.endsWith("%"));
  const formatVariant = hasPct
    ? `pct-${columns.length + 1}col`
    : `legacy-${columns.length + 1}col`;

  return {
    parser: EASYSTATS_PARSER,
    parserVersion: EASYSTATS_PARSER_VERSION,
    formatVariant,
    title: text(root.querySelector("title")) || null,
    dateText: text(root.querySelector("#game-date .detail")) || null,
    left,
    right,
    columns,
    playerRows,
    teamRows,
    periods: readPeriods(root),
    ...readShotChartScript(html),
    hasGameFlowImage: root.querySelector("img[alt='flow img']") !== null,
  };
}
