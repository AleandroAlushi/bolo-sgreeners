/**
 * Calendario delle "paste": ognuno le porta una volta l'anno, nel suo giorno (lo stesso della
 * stagione precedente, salvato come giorno e mese).
 *
 * 1. Giorni di allenamento: i giorni della settimana scelti (default lunedì e giovedì) tra inizio
 *    e fine, esclusi i periodi di pausa e i giorni in cui si gioca (in casa o in trasferta).
 * 2. Chi ha un giorno porta le paste al primo allenamento utile da quel giorno in poi; se è già
 *    occupato da un altro, al successivo.
 * 3. Chi non ha ancora un giorno (es. i nuovi) resta "da impostare"; chi è esentato non compare.
 * Logica pura, senza database: le date sono stringhe ISO yyyy-mm-dd.
 */
export interface PastePerson {
  id: string;
  name: string;
  /** yyyy-mm-dd, oppure null se non ancora inserita (conta solo giorno e mese) */
  birthDate: string | null;
  /** giorno delle paste, "mm-gg"; null = da impostare */
  pasteDay: string | null;
  /** esentato: non porta le paste */
  exempt?: boolean;
}

export interface TrainingSetup {
  start: string;
  end: string;
  /** giorni ISO: 1 = lunedì … 7 = domenica */
  weekdays: number[];
  breaks: { start: string; end: string; label: string }[];
  /** giorni con una partita: niente allenamento */
  matchDays?: string[];
}

export interface PasteSlot {
  personId: string;
  name: string;
  /** allenamento in cui porta le paste */
  day: string;
  /** il suo giorno in questa stagione (yyyy-mm-dd) */
  target: string;
}

export interface PastePlan {
  slots: PasteSlot[];
  /** senza giorno: da impostare */
  unassigned: PastePerson[];
  /** con un giorno ma senza allenamenti liberi da lì a fine stagione */
  unplaced: PastePerson[];
  trainingDays: string[];
  /** allenamenti senza paste */
  freeDays: string[];
}

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const isoWeekday = (iso: string) => ((new Date(toTime(iso)).getUTCDay() + 6) % 7) + 1;

/** Giorni di allenamento (esclusi pause e giorni di partita). */
export function trainingDays(setup: TrainingSetup): string[] {
  const matchDays = new Set(setup.matchDays ?? []);
  const out: string[] = [];
  for (let t = toTime(setup.start); t <= toTime(setup.end); t += DAY) {
    const iso = toIso(t);
    if (!setup.weekdays.includes(isoWeekday(iso))) continue;
    if (setup.breaks.some((b) => iso >= b.start && iso <= b.end)) continue;
    if (matchDays.has(iso)) continue;
    out.push(iso);
  }
  return out;
}

/** "10-04" → la data di quella stagione (da settembre a maggio: ottobre è nell'anno di inizio). */
export function seasonDate(monthDay: string, setup: TrainingSetup): string | null {
  for (let y = Number(setup.start.slice(0, 4)); y <= Number(setup.end.slice(0, 4)); y++) {
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    const iso = monthDay === "02-29" && !leap ? `${y}-02-28` : `${y}-${monthDay}`;
    if (iso >= setup.start && iso <= setup.end) return iso;
  }
  return null;
}

export function planPaste(people: PastePerson[], setup: TrainingSetup): PastePlan {
  const days = trainingDays(setup);
  const taken = new Set<string>();
  const slots: PasteSlot[] = [];
  const unplaced: PastePerson[] = [];
  const withDay = people
    .filter((p) => !p.exempt && p.pasteDay)
    .map((p) => ({ person: p, target: seasonDate(p.pasteDay!, setup) }))
    .sort((a, b) => (a.target ?? "9999").localeCompare(b.target ?? "9999") || a.person.name.localeCompare(b.person.name));
  for (const { person, target } of withDay) {
    const day = target ? days.find((d) => d >= target && !taken.has(d)) : undefined;
    if (!target || !day) {
      unplaced.push(person);
      continue;
    }
    taken.add(day);
    slots.push({ personId: person.id, name: person.name, day, target });
  }
  return {
    slots,
    unassigned: people.filter((p) => !p.exempt && !p.pasteDay).sort((a, b) => a.name.localeCompare(b.name)),
    unplaced,
    trainingDays: days,
    freeDays: days.filter((d) => !taken.has(d)),
  };
}
