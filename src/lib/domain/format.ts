/** Formattazione in italiano (date, numeri, percentuali). Funzioni pure, usabili ovunque. */

const toUtcDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

const fmtShort = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtLong = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtDayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtMonthYear = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

export function formatDate(iso: string | null | undefined, style: "short" | "long" | "day-month" = "short"): string {
  if (!iso) return "Data da definire";
  const d = toUtcDate(iso);
  if (style === "long") return fmtLong.format(d);
  if (style === "day-month") return fmtDayMonth.format(d);
  return fmtShort.format(d);
}

const fmtBirthday = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
/** "1995-11-12" → "12 novembre" (senza anno) */
export const formatBirthday = (iso: string) => fmtBirthday.format(toUtcDate(iso));

export const formatMonthYear = (iso: string) => {
  const s = fmtMonthYear.format(toUtcDate(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const formatTime = (time: string | null | undefined) => (time ? time.slice(0, 5) : null);

const numberFormats = new Map<number, Intl.NumberFormat>();
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  let f = numberFormats.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, f);
  }
  return f.format(value);
}

/** 0.4567 → "45,7%" */
export const formatPct = (ratio: number | null | undefined, decimals = 1) =>
  ratio === null || ratio === undefined || Number.isNaN(ratio) ? "–" : `${formatNumber(ratio * 100, decimals)}%`;

export const formatSigned = (n: number | null | undefined) =>
  n === null || n === undefined ? "–" : n > 0 ? `+${n}` : String(n);

/** "8-13" dai valori realizzati/tentati */
export const formatMadeAttempted = (made: number | null | undefined, att: number | null | undefined) =>
  made === null || made === undefined || att === null || att === undefined ? "–" : `${made}/${att}`;

export const ratio = (num: number | null | undefined, den: number | null | undefined) =>
  num === null || num === undefined || !den ? null : num / den;
