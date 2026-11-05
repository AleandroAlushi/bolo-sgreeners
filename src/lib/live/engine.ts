/**
 * Partita in diretta: dagli eventi presi a bordo campo (in ordine) si ricostruiscono punteggio,
 * parziali, tabellino dei giocatori (minuti e +/- compresi), totali degli avversari e andamento.
 * Logica pura, usata sia dall'app che prende le statistiche sia dalla pagina live e dal salvataggio
 * finale del box score.
 */
import type { StatLine } from "@/lib/importers/types";

export type LiveKind = "2pt" | "3pt" | "1pt" | "dreb" | "oreb" | "tov" | "stl" | "ast" | "blk" | "foul" | "in" | "out";

export interface LiveEvent {
  id: string;
  /** ordine sul dispositivo che prende le statistiche */
  n: number;
  period: number;
  /** secondi rimasti nel periodo; null se l'orologio non è usato */
  clock: number | null;
  team: "own" | "opp";
  player_id: string | null;
  kind: LiveKind;
  made: boolean | null;
}

export interface LiveRosterEntry {
  player_id: string;
  jersey: string | null;
  name: string;
}

export interface LiveClock {
  period: number;
  periods: number;
  periodSeconds: number;
  /** secondi rimasti nel periodo in corso, già aggiornati all'istante attuale */
  remaining: number;
}

/** Durata dei supplementari (regola CSI: 5 minuti). */
export const OVERTIME_SECONDS = 300;

const POINTS: Partial<Record<LiveKind, number>> = { "2pt": 2, "3pt": 3, "1pt": 1 };

export const emptyLine = (): StatLine => ({
  minutes: null,
  points: 0,
  fgm: 0,
  fga: 0,
  fg3m: 0,
  fg3a: 0,
  ftm: 0,
  fta: 0,
  oreb: 0,
  dreb: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  tov: 0,
  blk: 0,
  pf: 0,
  plus_minus: 0,
});

const periodLength = (period: number, periods: number, periodSeconds: number) => (period <= periods ? periodSeconds : OVERTIME_SECONDS);

/** Secondi di gioco trascorsi dall'inizio della partita a (periodo, secondi rimasti). */
export function elapsed(period: number, remaining: number, periods: number, periodSeconds: number): number {
  let t = 0;
  for (let p = 1; p < period; p++) t += periodLength(p, periods, periodSeconds);
  return t + periodLength(period, periods, periodSeconds) - remaining;
}

/** Secondi rimasti nel periodo adesso, dato lo stato salvato dell'orologio. */
export function clockNow(state: { clock_remaining: number; clock_running: boolean; clock_updated_at: string }, now = Date.now()): number {
  if (!state.clock_running) return state.clock_remaining;
  const gone = (now - new Date(state.clock_updated_at).getTime()) / 1000;
  return Math.max(0, Math.round(state.clock_remaining - gone));
}

/** "7:05" */
export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;

/** "1° quarto", "2° supplementare" */
export function periodLabel(period: number, periods: number) {
  if (period > periods) return `${period - periods}° supplementare`;
  return periods === 2 ? `${period}° tempo` : `${period}° quarto`;
}
export const periodShort = (period: number, periods: number) => (period > periods ? `OT${period - periods}` : periods === 2 ? `T${period}` : `Q${period}`);

export interface LiveSummary {
  score: { own: number; opp: number };
  /** punti per periodo (indice 0 = primo periodo) */
  periods: { own: number; opp: number }[];
  players: Map<string, StatLine & { onCourt: boolean; entered: boolean }>;
  opponent: StatLine;
  own: StatLine;
  /** falli di squadra nel periodo in corso */
  teamFouls: { own: number; opp: number };
  onCourt: string[];
  /** andamento: punteggio dopo ogni canestro, con il tempo di gioco se l'orologio è usato */
  timeline: { t: number | null; i: number; period: number; own: number; opp: number }[];
  usesClock: boolean;
}

/**
 * Rigioca gli eventi in ordine. I minuti si contano dai cambi (in/out) e dall'orologio;
 * `until` è l'istante fino a cui contare chi è ancora in campo (orologio attuale o fine partita).
 */
export function summarize(events: LiveEvent[], roster: LiveRosterEntry[], clock: LiveClock): LiveSummary {
  const sorted = [...events].sort((a, b) => a.n - b.n);
  const players = new Map<string, StatLine & { onCourt: boolean; entered: boolean }>();
  for (const r of roster) players.set(r.player_id, { ...emptyLine(), minutes: 0, onCourt: false, entered: false });
  const line = (id: string) => {
    if (!players.has(id)) players.set(id, { ...emptyLine(), minutes: 0, onCourt: false, entered: false });
    return players.get(id)!;
  };
  const opponent = emptyLine();
  const score = { own: 0, opp: 0 };
  const periods: { own: number; opp: number }[] = [];
  const timeline: LiveSummary["timeline"] = [{ t: 0, i: 0, period: 1, own: 0, opp: 0 }];
  const onCourt = new Set<string>();
  const usesClock = sorted.some((e) => e.clock !== null);
  let lastT = 0;
  const fouls = new Map<number, { own: number; opp: number }>();

  const advance = (t: number) => {
    if (!usesClock || t <= lastT) return;
    for (const id of onCourt) line(id).minutes! += (t - lastT) / 60;
    lastT = t;
  };

  for (const e of sorted) {
    if (e.clock !== null) advance(elapsed(e.period, e.clock, clock.periods, clock.periodSeconds));
    while (periods.length < e.period) periods.push({ own: 0, opp: 0 });
    if (!fouls.has(e.period)) fouls.set(e.period, { own: 0, opp: 0 });

    if (e.kind === "in" || e.kind === "out") {
      if (e.team !== "own" || !e.player_id) continue;
      const l = line(e.player_id);
      if (e.kind === "in") {
        onCourt.add(e.player_id);
        l.onCourt = true;
        l.entered = true;
      } else {
        onCourt.delete(e.player_id);
        l.onCourt = false;
      }
      continue;
    }

    const target = e.team === "own" ? (e.player_id ? line(e.player_id) : null) : opponent;
    const pts = POINTS[e.kind];
    if (pts) {
      const made = e.made === true;
      if (target) {
        if (e.kind === "1pt") {
          target.fta! += 1;
          if (made) target.ftm! += 1;
        } else {
          target.fga! += 1;
          if (made) target.fgm! += 1;
          if (e.kind === "3pt") {
            target.fg3a! += 1;
            if (made) target.fg3m! += 1;
          }
        }
        if (made) target.points! += pts;
      }
      if (made) {
        if (e.team === "own") score.own += pts;
        else score.opp += pts;
        periods[e.period - 1][e.team] += pts;
        // +/-: chi è in campo quando la squadra segna o subisce
        for (const id of onCourt) line(id).plus_minus! += e.team === "own" ? pts : -pts;
        timeline.push({
          t: e.clock !== null ? elapsed(e.period, e.clock, clock.periods, clock.periodSeconds) : null,
          i: timeline.length,
          period: e.period,
          own: score.own,
          opp: score.opp,
        });
      }
      continue;
    }
    if (!target) continue;
    if (e.kind === "dreb") target.dreb! += 1;
    if (e.kind === "oreb") target.oreb! += 1;
    if (e.kind === "dreb" || e.kind === "oreb") target.reb! += 1;
    if (e.kind === "tov") target.tov! += 1;
    if (e.kind === "stl") target.stl! += 1;
    if (e.kind === "ast") target.ast! += 1;
    if (e.kind === "blk") target.blk! += 1;
    if (e.kind === "foul") {
      target.pf! += 1;
      fouls.get(e.period)![e.team] += 1;
    }
  }
  advance(elapsed(clock.period, clock.remaining, clock.periods, clock.periodSeconds));
  while (periods.length < clock.period) periods.push({ own: 0, opp: 0 });

  const own = emptyLine();
  for (const l of players.values()) {
    for (const k of Object.keys(own) as (keyof StatLine)[]) {
      if (k === "minutes" || k === "plus_minus") continue;
      own[k] = (own[k] ?? 0) + (l[k] ?? 0);
    }
    if (!usesClock) l.minutes = null;
    else l.minutes = Math.round(l.minutes! * 100) / 100;
  }
  opponent.minutes = null;
  opponent.plus_minus = null;
  own.minutes = null;
  own.plus_minus = null;
  return {
    score,
    periods,
    players,
    opponent,
    own,
    teamFouls: fouls.get(clock.period) ?? { own: 0, opp: 0 },
    onCourt: [...onCourt],
    timeline,
    usesClock,
  };
}

/** Fine partita: l'orologio sta a 0 nell'ultimo periodo giocato. */
export const finalClock = (period: number, periods: number, periodSeconds: number): LiveClock => ({ period, periods, periodSeconds, remaining: 0 });
