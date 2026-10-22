/**
 * Calendario delle "paste": chi compie gli anni le porta al primo allenamento utile; ogni
 * settimana di allenamenti deve avere almeno una pasta.
 *
 * 1. Giorni di allenamento: i giorni della settimana scelti (default lunedì e giovedì) tra inizio
 *    e fine, esclusi i periodi di pausa.
 * 2. Compleanno: la pasta va al primo allenamento dal giorno del compleanno in poi, entro 7 giorni.
 * 3. Compleanno in pausa o d'estate: "recuperato" nella prima settimana libera dopo il compleanno
 *    (se non ce ne sono, la più vicina prima).
 * 4. Settimane ancora senza paste: un turno a chi ne ha portate meno, a parità a chi le ha
 *    portate da più tempo, poi a chi ha il compleanno più vicino a quella settimana.
 * Logica pura, senza database: le date sono stringhe ISO yyyy-mm-dd.
 */
export interface PastePerson {
  id: string;
  name: string;
  /** yyyy-mm-dd, oppure null se non ancora inserita */
  birthDate: string | null;
}

export interface TrainingSetup {
  start: string;
  end: string;
  /** giorni ISO: 1 = lunedì … 7 = domenica */
  weekdays: number[];
  breaks: { start: string; end: string; label: string }[];
}

export type PasteReason = "birthday" | "recovered" | "turn";

export interface PasteAssignment {
  personId: string;
  name: string;
  /** allenamento in cui porta le paste */
  day: string;
  reason: PasteReason;
  /** compleanno di quest'anno (per "birthday" e "recovered") */
  birthday: string | null;
}

export interface PasteWeek {
  /** lunedì della settimana */
  weekStart: string;
  trainingDays: string[];
  assignments: PasteAssignment[];
}

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const isoWeekday = (iso: string) => ((new Date(toTime(iso)).getUTCDay() + 6) % 7) + 1;
const mondayOf = (iso: string) => toIso(toTime(iso) - (isoWeekday(iso) - 1) * DAY);
const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);

/** Giorni di allenamento (esclusi quelli in pausa). */
export function trainingDays(setup: TrainingSetup): string[] {
  const out: string[] = [];
  for (let t = toTime(setup.start); t <= toTime(setup.end); t += DAY) {
    const iso = toIso(t);
    if (!setup.weekdays.includes(isoWeekday(iso))) continue;
    if (setup.breaks.some((b) => iso >= b.start && iso <= b.end)) continue;
    out.push(iso);
  }
  return out;
}

/** Il compleanno che cade nel periodo (o, se cade fuori, il più vicino al periodo). */
function birthdayInSeason(birthDate: string, setup: TrainingSetup): string | null {
  const md = birthDate.slice(5);
  const startYear = Number(setup.start.slice(0, 4));
  const endYear = Number(setup.end.slice(0, 4));
  const candidates: string[] = [];
  for (let y = startYear - 1; y <= endYear + 1; y++) {
    // 29 febbraio negli anni non bisestili: 28 febbraio
    const iso = md === "02-29" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? `${y}-02-28` : `${y}-${md}`;
    candidates.push(iso);
  }
  const inside = candidates.find((d) => d >= setup.start && d <= setup.end);
  if (inside) return inside;
  const distance = (d: string) => Math.min(Math.abs(daysBetween(d, setup.start)), Math.abs(daysBetween(d, setup.end)));
  return candidates.sort((a, b) => distance(a) - distance(b))[0] ?? null;
}

/** Distanza in giorni tra due date ignorando l'anno (0-182). */
function circularDistance(a: string, b: string) {
  const doy = (iso: string) => daysBetween(`${iso.slice(0, 4)}-01-01`, iso);
  const d = Math.abs(doy(a) - doy(b));
  return Math.min(d, 365 - d);
}

export function planPaste(people: PastePerson[], setup: TrainingSetup): PasteWeek[] {
  const days = trainingDays(setup);
  const weeks = new Map<string, PasteWeek>();
  for (const d of days) {
    const w = mondayOf(d);
    if (!weeks.has(w)) weeks.set(w, { weekStart: w, trainingDays: [], assignments: [] });
    weeks.get(w)!.trainingDays.push(d);
  }
  const ordered = [...weeks.values()];
  if (ordered.length === 0) return [];
  const count = new Map(people.map((p) => [p.id, 0]));
  const assign = (week: PasteWeek, p: PastePerson, day: string, reason: PasteReason, birthday: string | null) => {
    week.assignments.push({ personId: p.id, name: p.name, day, reason, birthday });
    count.set(p.id, (count.get(p.id) ?? 0) + 1);
  };

  // 2. compleanni al primo allenamento utile
  const recover: { person: PastePerson; birthday: string }[] = [];
  for (const p of people) {
    if (!p.birthDate) continue;
    const birthday = birthdayInSeason(p.birthDate, setup);
    if (!birthday) continue;
    const day = days.find((d) => d >= birthday);
    if (day && daysBetween(birthday, day) <= 7) assign(weeks.get(mondayOf(day))!, p, day, "birthday", birthday);
    else recover.push({ person: p, birthday });
  }

  // 3. compleanni in pausa o fuori stagione: prima settimana libera dopo il compleanno
  for (const { person, birthday } of recover.sort((a, b) => a.birthday.localeCompare(b.birthday))) {
    const free = ordered.filter((w) => w.assignments.length === 0);
    const pool = free.length > 0 ? free : ordered;
    const after = pool.filter((w) => w.trainingDays.at(-1)! >= birthday);
    const target = after[0] ?? pool[pool.length - 1];
    assign(target, person, target.trainingDays[0], "recovered", birthday);
  }

  // 4. settimane ancora libere: turni equi, evitando la stessa persona in settimane vicine
  const weekIndex = new Map(ordered.map((w, i) => [w.weekStart, i]));
  const assignedWeeks = (id: string) => ordered.filter((w) => w.assignments.some((a) => a.personId === id)).map((w) => weekIndex.get(w.weekStart)!);
  for (const [i, week] of ordered.entries()) {
    if (week.assignments.length > 0 || people.length === 0) continue;
    const gap = (id: string) => Math.min(999, ...assignedWeeks(id).map((j) => Math.abs(i - j)));
    const pick = [...people].sort(
      (a, b) =>
        (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0) ||
        gap(b.id) - gap(a.id) ||
        (a.birthDate ? circularDistance(a.birthDate, week.weekStart) : 999) - (b.birthDate ? circularDistance(b.birthDate, week.weekStart) : 999) ||
        a.name.localeCompare(b.name),
    )[0];
    assign(week, pick, week.trainingDays[0], "turn", null);
  }
  for (const w of ordered) w.assignments.sort((a, b) => a.day.localeCompare(b.day) || a.name.localeCompare(b.name));
  return ordered;
}
