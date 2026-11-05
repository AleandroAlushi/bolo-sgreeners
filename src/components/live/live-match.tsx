"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatPct, ratio } from "@/lib/domain/format";
import {
  clockNow,
  elapsed,
  finalClock,
  formatClock,
  periodLabel,
  periodShort,
  summarize,
  type LiveEvent,
  type LiveRosterEntry,
  type LiveSummary,
} from "@/lib/live/engine";
import { browserClient } from "@/lib/supabase/browser";
import { cx } from "../ui";

interface LiveGameRow {
  id: string;
  match_id: string;
  status: string;
  period: number;
  periods: number;
  period_seconds: number;
  clock_remaining: number;
  clock_running: boolean;
  clock_updated_at: string;
  roster: unknown;
}

const POLL_LIVE_MS = 5000;
const POLL_IDLE_MS = 60000;

/** Oggi o ieri (fuso del telefono): solo allora si continua a cercare una diretta che non c'è ancora. */
function isAroundToday(date: string | null) {
  if (!date) return false;
  const d = new Date(`${date}T12:00:00`);
  const diff = (Date.now() - d.getTime()) / 86400_000;
  return diff > -1 && diff < 1.5;
}

/** Diretta di una partita (dati presi dal sito a bordo campo), aggiornata ogni 5 secondi. */
export function useLiveGame(matchId: string | null, matchDate: string | null) {
  const [game, setGame] = useState<LiveGameRow | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!matchId) return;
    const db = browserClient();
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const { data: g } = await db.from("live_games").select("*").eq("match_id", matchId).maybeSingle();
      if (stop) return;
      setGame(g);
      if (g) {
        const { data: ev } = await db.from("live_events").select("id, n, period, clock, team, player_id, kind, made").eq("game_id", g.id).order("n");
        if (!stop) setEvents((ev ?? []) as LiveEvent[]);
      }
      // un controllo all'apertura; poi si continua solo se la diretta c'è (o la partita è oggi).
      // La pagina in background non interroga il database.
      const live = g?.status === "live";
      if (!g && !isAroundToday(matchDate)) return;
      timer = setTimeout(load, document.hidden ? POLL_IDLE_MS : live ? POLL_LIVE_MS : POLL_IDLE_MS);
    };
    void load();
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matchId, matchDate]);

  // l'orologio scorre anche tra un aggiornamento e l'altro
  useEffect(() => {
    if (!game?.clock_running) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [game?.clock_running]);

  const roster = useMemo(() => (game?.roster ?? []) as LiveRosterEntry[], [game?.roster]);
  const remaining = game ? clockNow(game) : 0;
  const summary = useMemo(() => {
    if (!game) return null;
    const clock = game.status === "live" ? { period: game.period, periods: game.periods, periodSeconds: game.period_seconds, remaining } : finalClock(game.period, game.periods, game.period_seconds);
    return summarize(events, roster, clock);
  }, [game, events, roster, remaining]);
  return { game, events, roster, remaining, summary };
}

export function LiveMatch({ matchId, matchDate, ownName, opponentName, ownIsHome }: { matchId: string; matchDate: string | null; ownName: string; opponentName: string; ownIsHome: boolean }) {
  const { game, roster, remaining, summary: s } = useLiveGame(matchId, matchDate);
  if (!game || !s || game.status === "saved") return null;
  const live = game.status === "live";
  const sides = [
    { name: ownName, score: s.score.own, own: true },
    { name: opponentName, score: s.score.opp, own: false },
  ];
  if (!ownIsHome) sides.reverse();

  return (
    <section className="space-y-4" aria-label="Diretta">
      <div className="glow-panel rounded-3xl border border-border p-5 text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-widest">
          {live ? (
            <>
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-loss" />
              </span>
              Live
            </>
          ) : (
            "Finale"
          )}
        </p>
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {sides.map((t, i) => (
            <div key={t.name} className={cx("min-w-0 flex-1", i === 0 ? "text-right" : "text-left")}>
              <p className={cx("truncate text-sm font-semibold", t.own ? "text-primary" : "text-text/85")}>{t.name}</p>
              <p className="display text-7xl leading-none tabular-nums sm:text-8xl">{t.score}</p>
            </div>
          ))}
        </div>
        {live && (
          <p className="mt-2 text-sm font-semibold text-text/80">
            {periodLabel(game.period, game.periods)} · <span className="tabular-nums">{formatClock(remaining)}</span>
            {!game.clock_running && remaining > 0 && remaining < game.period_seconds ? " · tempo fermo" : ""}
          </p>
        )}
        <Periods s={s} periods={game.periods} ownName={ownName} opponentName={opponentName} />
      </div>

      <Flow s={s} ownName={ownName} opponentName={opponentName} periods={game.periods} periodSeconds={game.period_seconds} period={game.period} />

      <div className="card overflow-hidden">
        <p className="px-4 pt-3 text-sm font-semibold">Tabellino {live ? "in diretta" : ""}</p>
        <LiveBoxScore s={s} roster={roster} />
      </div>

      <Comparison s={s} ownName={ownName} opponentName={opponentName} />
    </section>
  );
}

function Periods({ s, periods, ownName, opponentName }: { s: LiveSummary; periods: number; ownName: string; opponentName: string }) {
  return (
    <div className="mx-auto mt-4 max-w-md overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-text/60">
            <th className="text-left font-semibold" />
            {s.periods.map((_, i) => (
              <th key={i} className="px-2 font-semibold">
                {periodShort(i + 1, periods)}
              </th>
            ))}
            <th className="px-2 font-semibold">Tot</th>
          </tr>
        </thead>
        <tbody>
          {(["own", "opp"] as const).map((k) => (
            <tr key={k}>
              <td className={cx("max-w-[8rem] truncate text-left font-semibold", k === "own" && "text-primary")}>{k === "own" ? ownName : opponentName}</td>
              {s.periods.map((p, i) => (
                <td key={i} className="px-2 text-center">
                  {p[k]}
                </td>
              ))}
              <td className="px-2 text-center font-bold">{s.score[k]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Andamento del punteggio (come il grafico di Easy Stats), con le linee di fine periodo. */
function Flow({
  s,
  ownName,
  opponentName,
  periods,
  periodSeconds,
  period,
}: {
  s: LiveSummary;
  ownName: string;
  opponentName: string;
  periods: number;
  periodSeconds: number;
  period: number;
}) {
  if (s.timeline.length < 2) return null;
  const W = 640;
  const H = 220;
  const pad = { l: 28, r: 10, t: 12, b: 22 };
  const byTime = s.usesClock && s.timeline.every((p) => p.t !== null);
  const xs = s.timeline.map((p) => (byTime ? p.t! : p.i));
  // asse del tempo fino alla fine del periodo in corso: a inizio partita il grafico non è schiacciato
  const maxX = Math.max(1, ...xs, byTime ? elapsed(period, 0, periods, periodSeconds) : 0);
  const shownPeriods = byTime ? Math.min(period, periods) : 0;
  const maxY = Math.max(10, ...s.timeline.map((p) => Math.max(p.own, p.opp)));
  const x = (v: number) => pad.l + (v / maxX) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
  const path = (k: "own" | "opp") =>
    s.timeline.map((p, i) => `${i ? "L" : "M"}${x(xs[i]).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const lead = s.score.own - s.score.opp;
  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Andamento</p>
        <p className="flex gap-3 text-xs">
          <span className="text-primary">● {ownName}</span>
          <span className="text-secondary">● {opponentName}</span>
          {lead !== 0 && <span className="text-muted">{lead > 0 ? `+${lead}` : lead}</span>}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Andamento del punteggio">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={y(maxY * f)} y2={y(maxY * f)} stroke="currentColor" className="text-border" strokeDasharray="2 4" />
        ))}
        {[0.5, 1].map((f) => (
          <text key={f} x={pad.l - 6} y={y(maxY * f) + 4} textAnchor="end" className="fill-current text-[10px] text-muted">
            {Math.round(maxY * f)}
          </text>
        ))}
        {byTime &&
          Array.from({ length: Math.max(0, shownPeriods - 1) }, (_, i) => (
            <g key={i}>
              <line x1={x((i + 1) * periodSeconds)} x2={x((i + 1) * periodSeconds)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-border" />
              <text x={x((i + 1) * periodSeconds) - 4} y={H - 6} textAnchor="end" className="fill-current text-[10px] text-muted">
                {periodShort(i + 1, periods)}
              </text>
            </g>
          ))}
        <path d={path("opp")} fill="none" stroke="var(--sg-secondary)" strokeWidth={2.5} strokeLinejoin="round" />
        <path d={path("own")} fill="none" stroke="var(--sg-primary)" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function LiveBoxScore({ s, roster }: { s: LiveSummary; roster: LiveRosterEntry[] }) {
  const rows = roster
    .map((r) => ({ r, l: s.players.get(r.player_id)! }))
    .filter((x) => x.l && (x.l.entered || x.l.points || x.l.reb || x.l.pf))
    .sort((a, b) => (b.l.points ?? 0) - (a.l.points ?? 0));
  const cols: { label: string; v: (l: (typeof rows)[number]["l"]) => string }[] = [
    ...(s.usesClock ? [{ label: "MIN", v: (l: (typeof rows)[number]["l"]) => String(Math.floor(l.minutes ?? 0)) }] : []),
    { label: "PTS", v: (l) => String(l.points) },
    { label: "TIRI", v: (l) => `${l.fgm}/${l.fga}` },
    { label: "3P", v: (l) => `${l.fg3m}/${l.fg3a}` },
    { label: "TL", v: (l) => `${l.ftm}/${l.fta}` },
    { label: "RIM", v: (l) => String(l.reb) },
    { label: "AST", v: (l) => String(l.ast) },
    { label: "REC", v: (l) => String(l.stl) },
    { label: "PP", v: (l) => String(l.tov) },
    { label: "STP", v: (l) => String(l.blk) },
    { label: "F", v: (l) => String(l.pf) },
    { label: "+/-", v: (l) => ((l.plus_minus ?? 0) > 0 ? `+${l.plus_minus}` : String(l.plus_minus ?? 0)) },
  ];
  if (rows.length === 0) return <p className="px-4 pb-4 pt-2 text-sm text-muted">Le statistiche dei giocatori compariranno qui.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="stat-table">
        <thead>
          <tr>
            <th>Giocatore</th>
            {cols.map((c) => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, l }) => (
            <tr key={r.player_id}>
              <td className="whitespace-nowrap font-semibold">
                {l.onCourt && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" title="In campo" />}
                <span className="text-muted">#{r.jersey}</span> {r.name}
              </td>
              {cols.map((c) => (
                <td key={c.label} className={cx("tabular-nums", c.label === "PTS" && "font-semibold text-text")}>
                  {c.v(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Comparison({ s, ownName, opponentName }: { s: LiveSummary; ownName: string; opponentName: string }) {
  const rows: { label: string; own: number; opp: number; text?: [string, string] }[] = [
    { label: "Tiri", own: ratio(s.own.fgm, s.own.fga) ?? 0, opp: ratio(s.opponent.fgm, s.opponent.fga) ?? 0, text: [`${s.own.fgm}/${s.own.fga} (${formatPct(ratio(s.own.fgm, s.own.fga))})`, `${s.opponent.fgm}/${s.opponent.fga} (${formatPct(ratio(s.opponent.fgm, s.opponent.fga))})`] },
    { label: "Triple", own: s.own.fg3m ?? 0, opp: s.opponent.fg3m ?? 0, text: [`${s.own.fg3m}/${s.own.fg3a}`, `${s.opponent.fg3m}/${s.opponent.fg3a}`] },
    { label: "Tiri liberi", own: s.own.ftm ?? 0, opp: s.opponent.ftm ?? 0, text: [`${s.own.ftm}/${s.own.fta}`, `${s.opponent.ftm}/${s.opponent.fta}`] },
    { label: "Rimbalzi", own: s.own.reb ?? 0, opp: s.opponent.reb ?? 0 },
    { label: "Assist", own: s.own.ast ?? 0, opp: s.opponent.ast ?? 0 },
    { label: "Recuperi", own: s.own.stl ?? 0, opp: s.opponent.stl ?? 0 },
    { label: "Palle perse", own: s.own.tov ?? 0, opp: s.opponent.tov ?? 0 },
    { label: "Stoppate", own: s.own.blk ?? 0, opp: s.opponent.blk ?? 0 },
    { label: "Falli", own: s.own.pf ?? 0, opp: s.opponent.pf ?? 0 },
  ];
  return (
    <div className="card p-4">
      <div className="mb-3 flex justify-between text-xs font-semibold">
        <span className="text-primary">{ownName}</span>
        <span className="text-secondary">{opponentName}</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const total = r.own + r.opp || 1;
          return (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-xs tabular-nums">
                <span>{r.text?.[0] ?? r.own}</span>
                <span className="text-muted">{r.label}</span>
                <span>{r.text?.[1] ?? r.opp}</span>
              </div>
              <div className="flex h-1.5 gap-1 overflow-hidden rounded-full">
                <span className="rounded-full bg-primary" style={{ width: `${(r.own / total) * 100}%` }} />
                <span className="rounded-full bg-secondary" style={{ width: `${(r.opp / total) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Striscia in home quando c'è una partita in diretta (solo il giorno della partita). */
export function LiveBanner({ matchId, matchDate, ownName, opponentName }: { matchId: string; matchDate: string | null; ownName: string; opponentName: string }) {
  const { game, remaining, summary: s } = useLiveGame(matchId, matchDate);
  if (!game || !s || game.status !== "live") return null;
  return (
    <Link href={`/partite/${matchId}`} className="lift flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-loss" />
      </span>
      <span className="text-xs font-bold uppercase tracking-widest text-loss">Live</span>
      <span className="min-w-0 flex-1 truncate font-semibold">
        {ownName} <span className="display text-xl tabular-nums">{s.score.own}–{s.score.opp}</span> {opponentName}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted">
        {periodShort(game.period, game.periods)} {formatClock(remaining)} ›
      </span>
    </Link>
  );
}
