/**
 * Didascalie per Instagram, scritte dai numeri della partita: una bozza da rileggere prima di
 * pubblicare (stile dei post di @bolo.sgreeners: titolo, record, MVP con tag, prossima partita).
 */

export interface CaptionPlayer {
  name: string;
  /** profilo Instagram senza @ (dati riservati), se c'è */
  instagram: string | null;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

export interface NextGame {
  date: string | null;
  home: boolean | null;
  opponent: string;
  /** prima partita in casa / in trasferta della stagione */
  firstOfKind: boolean;
}

export interface PostCaptionInput {
  ownScore: number;
  oppScore: number;
  home: boolean | null;
  opponent: string;
  date: string | null;
  /** record della stagione dopo questa partita */
  wins: number;
  losses: number;
  /** prima partita della stagione / prima in casa / prima in trasferta */
  firstGame: boolean;
  firstOfKind: boolean;
  /** vittorie (o sconfitte) di fila, compresa questa */
  streak: number;
  mvp: CaptionPlayer | null;
  /** quanti MVP ha in stagione l'MVP, compreso questo */
  mvpCount: number;
  players: CaptionPlayer[];
  next: NextGame | null;
}

const ORD_M = ["Primo", "Secondo", "Terzo", "Quarto", "Quinto", "Sesto", "Settimo", "Ottavo", "Nono", "Decimo"];
const ORD_F = ["Prima", "Seconda", "Terza", "Quarta", "Quinta", "Sesta", "Settima", "Ottava", "Nona", "Decima"];
const DAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const tag = (p: Pick<CaptionPlayer, "name" | "instagram">) => (p.instagram ? `@${p.instagram}` : p.name);

/** "lunedì 2 novembre" */
export const longDay = (iso: string) => {
  const d = utc(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Quando si gioca rispetto a oggi: "mercoledì" entro la settimana, altrimenti "sabato 14 novembre". */
export function when(date: string | null, from: string | null): string {
  if (!date) return "alla prossima";
  if (from) {
    const gap = daysBetween(from, date);
    if (gap === 1) return "domani";
    if (gap > 1 && gap < 7) return DAYS[utc(date).getUTCDay()];
  }
  return longDay(date);
}

/** "12 punti, 4 rimbalzi, 3 assist e 3 recuperi" (solo le voci diverse da zero). */
export function statLine(p: CaptionPlayer): string {
  const parts = [
    [p.pts, "punti", "punto"],
    [p.reb, "rimbalzi", "rimbalzo"],
    [p.ast, "assist", "assist"],
    [p.stl, "recuperi", "recupero"],
    [p.blk, "stoppate", "stoppata"],
  ]
    .filter(([v]) => (v as number) > 0)
    .map(([v, many, one]) => `${v} ${v === 1 ? one : many}`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

const doubles = (p: CaptionPlayer) => [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length;

/** Un dettaglio in più oltre all'MVP: doppia doppia, dominio a rimbalzo, giocatori in doppia cifra. */
function highlight(players: CaptionPlayer[], mvp: CaptionPlayer | null): string | null {
  const others = players.filter((p) => p.name !== mvp?.name);
  const dd = others.find((p) => doubles(p) >= 2);
  if (dd) {
    const pair = [
      [dd.pts, "punti"],
      [dd.reb, "rimbalzi"],
      [dd.ast, "assist"],
      [dd.stl, "recuperi"],
    ].filter(([v]) => (v as number) >= 10);
    return `Doppia doppia per ${tag(dd)} (${pair.map(([v, l]) => `${v} ${l}`).join(" e ")}).`;
  }
  const boards = [...others].sort((a, b) => b.reb - a.reb)[0];
  if (boards && boards.reb >= 10) return `${boards.reb} rimbalzi per ${tag(boards)}.`;
  const tens = players.filter((p) => p.pts >= 10).length;
  if (tens >= 3) return `${capitalize(["", "", "", "tre", "quattro", "cinque", "sei"][tens] ?? String(tens))} giocatori in doppia cifra.`;
  return null;
}

function nextLine(next: NextGame | null, from: string | null): string | null {
  if (!next) return null;
  const w = when(next.date, from);
  if (next.home === false) {
    return next.firstOfKind ? `Vi aspettiamo ${w} per la prima trasferta della stagione!` : `${capitalize(w)} si va in trasferta contro ${next.opponent}!`;
  }
  if (next.home === true) {
    return next.firstOfKind ? `Vi aspettiamo ${w} per la prima in casa della stagione!` : `Vi aspettiamo ${w} in casa contro ${next.opponent}!`;
  }
  return `Prossima partita ${w} contro ${next.opponent}!`;
}

/** Didascalia del post dopo la partita. */
export function postCaption(c: PostCaptionInput): string {
  const won = c.ownScore > c.oppScore;
  const margin = Math.abs(c.ownScore - c.oppScore);
  const where = c.home === false ? "in trasferta" : c.home === true ? "in casa" : "";
  let title: string;
  if (won) {
    if (c.firstGame) title = "Buona la prima ✅";
    else if (c.firstOfKind && where) title = `Buona la prima ${where} ✅`;
    else if (c.streak >= 3) title = `${ORD_F[c.streak - 1] ?? `${c.streak}ª`} vittoria di fila ✅`;
    else title = `Vittoria${where ? ` ${where}` : ""} ✅`;
  } else {
    title = margin <= 5 ? `Sconfitta di misura${where ? ` ${where}` : ""}` : `Sconfitta${where ? ` ${where}` : ""}`;
  }
  const score = `${c.ownScore}-${c.oppScore}`;
  const story = won
    ? margin >= 20
      ? `Successo largo contro ${c.opponent} (${score}).`
      : margin <= 5
        ? `Vittoria sofferta contro ${c.opponent} (${score}).`
        : `Vittoria contro ${c.opponent} per ${score}.`
    : margin <= 5
      ? `Ci arrendiamo per pochi punti contro ${c.opponent} (${score}).`
      : `Contro ${c.opponent} finisce ${score}, si riparte dalla prossima.`;
  const lines = [title, `${c.wins}-${c.losses}`];
  if (c.mvp) {
    const n = Math.max(1, c.mvpCount);
    lines.push(`${ORD_M[n - 1] ?? `${n}°`} #mvp ${n === 1 ? "del match" : "stagionale"} per ${tag(c.mvp)}`);
  }
  const mvpStats = c.mvp && statLine(c.mvp);
  const mvpSentence = mvpStats ? (doubles(c.mvp!) >= 2 ? `Doppia doppia per ${c.mvp!.name}: ${mvpStats}.` : `${c.mvp!.name}: ${mvpStats}.`) : null;
  lines.push([story, mvpSentence, highlight(c.players, c.mvp)].filter(Boolean).join(" "));
  const after = nextLine(c.next, c.date);
  if (after) lines.push(after);
  lines.push("#bolosgreeners");
  return lines.join("\n");
}

export interface PreCaptionInput {
  opponent: string;
  home: boolean | null;
  date: string | null;
  time: string | null;
  venue: string | null;
}

/** Didascalia della presentazione (mattina della partita). */
export function preCaption(c: PreCaptionInput): string {
  const day = c.date ? longDay(c.date) : "data da definire";
  return [
    "Game day 🏀",
    `Bolo Sgreeners ${c.home === false ? "in trasferta contro" : "vs"} ${c.opponent}`,
    `${capitalize(day)}${c.time ? `, ore ${c.time.slice(0, 5)}` : ""}`,
    c.venue ? `📍 ${c.venue}` : null,
    c.home === false ? "Forza Sgreeners!" : "Vi aspettiamo!",
    "#bolosgreeners",
  ]
    .filter(Boolean)
    .join("\n");
}
