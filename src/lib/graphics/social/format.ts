/** Piccole regole delle grafiche nuove, senza dipendenze (testate in tests/social.test.ts). */

const DAYS = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];

/** "LUN 2.11" (giorno e mese senza zeri davanti, come nelle grafiche). */
export function shortDay(iso: string | null): string {
  if (!iso) return "DATA DA DEFINIRE";
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}

/** Parole da saltare per ricavare la sigla dal nome della squadra. */
const NOISE = new Set([
  "polisportiva",
  "pol",
  "asd",
  "ssd",
  "a.s.d.",
  "s.s.d.",
  "gs",
  "g.s.",
  "us",
  "u.s.",
  "ac",
  "sc",
  "cus",
  "csi",
  "basket",
  "basketball",
  "pallacanestro",
  "team",
  "the",
  "di",
  "de",
  "del",
  "della",
  "la",
  "il",
  "lo",
  "le",
  "i",
  "gli",
]);

/** Sigla di 3 lettere dal nome ("Polisportiva Trottola" → "TRO"), se l'admin non l'ha impostata. */
export function teamCode(name: string): string {
  const words = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s\-/]+/)
    .filter((w) => w && !NOISE.has(w));
  const word = (words[0] ?? name).replace(/[^a-z0-9]/g, "");
  return (word.slice(0, 3) || "???").toUpperCase();
}

/** Valutazione per scegliere l'MVP quando l'admin non l'ha indicato. */
export function mvpScore(l: { points: number | null; reb: number | null; ast: number | null; stl: number | null; blk: number | null; fga: number | null; fgm: number | null; fta: number | null; ftm: number | null; tov: number | null }): number {
  const n = (v: number | null) => v ?? 0;
  return n(l.points) + n(l.reb) + n(l.ast) + n(l.stl) + n(l.blk) - (n(l.fga) - n(l.fgm)) - (n(l.fta) - n(l.ftm)) - n(l.tov);
}
