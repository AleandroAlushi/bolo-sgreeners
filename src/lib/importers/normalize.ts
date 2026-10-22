/**
 * Funzioni di normalizzazione riutilizzabili da tutti gli importer
 * (nomi, numeri di maglia, coppie realizzati-tentati, date).
 */
import { CORE_STAT_KEYS, type StatLine } from "./types";

/** Normalizza un nome per il confronto: minuscolo, senza accenti, spazi compattati. */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalizza il nome di una squadra per confronti tolleranti. */
export function normalizeTeamName(name: string): string {
  return normalizePlayerName(name.replace(/[’`]/g, "'"));
}

/** "#32 Chicco" → { jersey: "32", name: "Chicco" }. "0" e "00" restano distinti. */
export function parseJerseyLabel(label: string): { jersey: string | null; name: string } {
  const m = label.trim().match(/^#\s*(\d+)\s*(.*)$/);
  if (!m) return { jersey: null, name: label.trim() };
  return { jersey: m[1], name: m[2].trim() };
}

/** "8-13" → [8, 13]; "-" o vuoto → null. */
export function parseMadeAttempted(value: string): [number, number] | null {
  const m = value.trim().match(/^(\d+)\s*[-/]\s*(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

/** Intero con segno ("-12", "+5", "22"); "-" o vuoto → null. */
export function parseIntCell(value: string): number | null {
  const v = value.trim();
  if (!/^[+-]?\d+$/.test(v)) return null;
  return Number.parseInt(v, 10);
}

const MONTHS: Record<string, number> = {
  jan: 1, gen: 1, feb: 2, mar: 3, apr: 4, may: 5, mag: 5, jun: 6, giu: 6,
  jul: 7, lug: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, ott: 10,
  nov: 11, dec: 12, dic: 12,
};

/** "14 Feb 2024" / "21 ott 2025" / "2025-10-21" / "21/10/2025" → "2025-10-21". */
export function parseMatchDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  const pad = (n: number) => String(n).padStart(2, "0");
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = v.match(/^(\d{1,2})\s+([a-zà-ù]+)\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3)];
    if (!month) return null;
    const day = Number(m[1]);
    if (day < 1 || day > 31) return null;
    return `${m[3]}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

export function emptyStatLine(): StatLine {
  return Object.fromEntries(CORE_STAT_KEYS.map((k) => [k, null])) as StatLine;
}

/** Punti attesi dai tiri: 2·(FGM−3PM) + 3·3PM + FTM. null se mancano dati. */
export function pointsFromShooting(s: StatLine): number | null {
  if (s.fgm === null || s.fg3m === null || s.ftm === null) return null;
  return 2 * (s.fgm - s.fg3m) + 3 * s.fg3m + s.ftm;
}

/** Completa i rimbalzi totali quando sono noti offensivi e difensivi. */
export function withDerivedRebounds(s: StatLine): StatLine {
  if (s.reb === null && s.oreb !== null && s.dreb !== null) {
    return { ...s, reb: s.oreb + s.dreb };
  }
  return s;
}

/** true se la riga contiene almeno un valore diverso da zero. */
export function hasAnyNonZero(s: StatLine): boolean {
  return CORE_STAT_KEYS.some((k) => s[k] !== null && s[k] !== 0);
}
