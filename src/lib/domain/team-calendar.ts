/**
 * Appuntamenti della squadra per il calendario mensile dell'area squadra: allenamenti (con
 * orario), partite (durata ipotizzata 1h30), compleanni ("Auguri Teo!"), paste e pause.
 * Logica pura, senza database: le date sono stringhe ISO yyyy-mm-dd.
 */
import { trainingDays, type PasteSlot, type TrainingSetup } from "./paste";

export type CalKind = "match" | "training" | "paste" | "birthday" | "break";

export interface CalEvent {
  date: string;
  kind: CalKind;
  title: string;
  /** "22:00–23:30" */
  time?: string;
  detail?: string;
  /** paste già portate */
  done?: boolean;
  href?: string;
}

export interface CalMatch {
  id: string;
  date: string;
  time: string | null;
  opponent: string;
  home: boolean;
  venue: string | null;
}

export interface CalPerson {
  id: string;
  name: string;
  short: string;
  birthDate: string | null;
}

/** Durata ipotizzata di una partita. */
export const MATCH_MINUTES = 90;

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const isoWeekday = (iso: string) => ((new Date(toTime(iso)).getUTCDay() + 6) % 7) + 1;

/** "22:15" + 90 minuti → "23:45" (oltre mezzanotte riparte da 00:00). */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Ordine nella stessa giornata. */
const ORDER: Record<CalKind, number> = { match: 0, training: 1, paste: 2, birthday: 3, break: 4 };

export function buildTeamCalendar({
  setup,
  times,
  matches,
  people,
  slots,
}: {
  setup: TrainingSetup;
  /** orari per giorno ISO ("1" = lunedì) */
  times: Record<string, [string, string]>;
  matches: CalMatch[];
  people: CalPerson[];
  slots: PasteSlot[];
}): CalEvent[] {
  const events: CalEvent[] = [];

  for (const day of trainingDays(setup)) {
    const t = times[String(isoWeekday(day))];
    events.push({ date: day, kind: "training", title: "Allenamento", time: t ? `${t[0]}–${t[1]}` : undefined });
  }

  for (const m of matches) {
    events.push({
      date: m.date,
      kind: "match",
      title: `${m.home ? "vs" : "@"} ${m.opponent}`,
      time: m.time ? `${m.time}–${addMinutes(m.time, MATCH_MINUTES)}` : undefined,
      detail: [m.home ? "In casa" : "In trasferta", m.venue].filter(Boolean).join(" · "),
      href: `/partite/${m.id}`,
    });
  }

  const short = new Map(people.map((p) => [p.id, p.short]));
  for (const s of slots) {
    events.push({
      date: s.day,
      kind: "paste",
      title: `Paste: ${short.get(s.personId) ?? s.name}`,
      detail: s.done ? "Portate ✓" : s.name,
      done: s.done,
    });
  }

  // compleanni dentro la stagione (es. da settembre a maggio: ottobre nell'anno di inizio)
  const firstYear = Number(setup.start.slice(0, 4));
  const lastYear = Number(setup.end.slice(0, 4));
  for (const p of people) {
    if (!p.birthDate) continue;
    const md = p.birthDate.slice(5);
    for (let y = firstYear; y <= lastYear; y++) {
      const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
      const day = md === "02-29" && !leap ? `${y}-02-28` : `${y}-${md}`;
      if (day >= setup.start && day <= setup.end) {
        events.push({ date: day, kind: "birthday", title: `Auguri ${p.short}! 🎂`, detail: p.name });
      }
    }
  }

  for (const b of setup.breaks) {
    for (let t = toTime(b.start); t <= toTime(b.end); t += DAY) {
      const day = toIso(t);
      if (day >= setup.start && day <= setup.end) events.push({ date: day, kind: "break", title: b.label });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || ORDER[a.kind] - ORDER[b.kind]);
}
