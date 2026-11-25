/**
 * Andamento del punteggio di una partita seguita con le statistiche live: punteggio dopo ogni
 * canestro, sull'asse del tempo di gioco (o del numero del canestro se l'orologio non è stato usato),
 * con la fine dei periodi. Serve alla pagina della partita anche dopo il salvataggio del box score.
 */
import { finalClock, OVERTIME_SECONDS, periodShort, summarize, type LiveEvent, type LiveRosterEntry } from "./engine";

export interface ScoreFlow {
  points: { x: number; own: number; opp: number }[];
  /** fine dell'asse x (fine dell'ultimo periodo giocato) */
  maxX: number;
  /** fine dei periodi, con l'etichetta del periodo che si chiude (Q1, Q2… OT1) */
  periodEnds: { x: number; label: string }[];
  /** etichetta dell'ultimo periodo */
  lastLabel: string;
  byTime: boolean;
}

export function scoreFlow(
  game: { period: number; periods: number; period_seconds: number; roster: LiveRosterEntry[] },
  events: LiveEvent[],
): ScoreFlow | null {
  const s = summarize(events, game.roster, finalClock(game.period, game.periods, game.period_seconds));
  if (s.timeline.length < 2) return null;
  const byTime = s.usesClock && s.timeline.every((p) => p.t !== null);
  const points = s.timeline.map((p) => ({ x: byTime ? p.t! : p.i, own: p.own, opp: p.opp }));
  const played = Math.max(game.period, game.periods);
  const regular = game.periods * game.period_seconds;
  const end = regular + Math.max(0, played - game.periods) * OVERTIME_SECONDS;
  const maxX = byTime ? Math.max(end, ...points.map((p) => p.x)) : Math.max(1, ...points.map((p) => p.x));
  const periodEnds = byTime
    ? Array.from({ length: played - 1 }, (_, i) => {
        const k = i + 1;
        return { x: k <= game.periods ? k * game.period_seconds : regular + (k - game.periods) * OVERTIME_SECONDS, label: periodShort(k, game.periods) };
      })
    : [];
  return { points, maxX, periodEnds, lastLabel: periodShort(played, game.periods), byTime };
}
