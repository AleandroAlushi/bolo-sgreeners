"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatMinutes, formatSigned } from "@/lib/domain/format";
import {
  clockNow,
  formatClock,
  periodLabel,
  summarize,
  type LiveEvent,
  type LiveKind,
  type LiveRosterEntry,
} from "@/lib/live/engine";
import { saveLiveBoxScore } from "@/lib/live/actions";
import { publicMediaUrl } from "@/lib/media";
import { browserClient } from "@/lib/supabase/browser";
import { cx } from "../ui";
import { IconAssist, IconBlock, IconDreb, IconFoul, IconOreb, IconSteal, IconSub, IconTurnover } from "./action-icons";

export interface ScorerGame {
  id: string;
  match_id: string;
  status: string;
  period: number;
  periods: number;
  period_seconds: number;
  clock_remaining: number;
  clock_running: boolean;
  clock_updated_at: string;
  roster: LiveRosterEntry[];
}

interface Props {
  game: ScorerGame;
  initialEvents: LiveEvent[];
  ownName: string;
  opponentName: string;
  photos: Record<string, string | null>;
}

type Pending = { kind: LiveKind; made: boolean | null; label: string; brick?: boolean } | null;

const ACTION_LABEL: Record<LiveKind, string> = {
  "2pt": "2 punti",
  "3pt": "3 punti",
  "1pt": "Tiro libero",
  dreb: "Rimbalzo difensivo",
  oreb: "Rimbalzo offensivo",
  tov: "Palla persa",
  stl: "Recupero",
  ast: "Assist",
  blk: "Stoppata",
  foul: "Fallo",
  in: "Entra",
  out: "Esce",
};

const ACTION_ICON: Record<"dreb" | "oreb" | "ast" | "blk" | "stl" | "tov" | "foul", ReactNode> = {
  dreb: <IconDreb />,
  oreb: <IconOreb />,
  ast: <IconAssist />,
  blk: <IconBlock />,
  stl: <IconSteal />,
  tov: <IconTurnover />,
  foul: <IconFoul />,
};

const store = (id: string) => `sg-live:${id}`;
const newId = () => crypto.randomUUID();

/** App per prendere le statistiche a bordo campo: salva sul dispositivo e invia al database. */
/** Eventi rimasti sul dispositivo (rete assente, pagina ricaricata): hanno la precedenza. */
function restore(gameId: string, initialEvents: LiveEvent[]) {
  const empty = { events: initialEvents, pending: [] as string[], deleted: [] as string[] };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(store(gameId));
    if (!raw) return empty;
    const saved = JSON.parse(raw) as { events: LiveEvent[]; pending: string[]; deleted: string[] };
    const byId = new Map(initialEvents.map((e) => [e.id, e]));
    for (const e of saved.events) if (saved.pending.includes(e.id)) byId.set(e.id, e);
    for (const id of saved.deleted) byId.delete(id);
    return { events: [...byId.values()].sort((a, b) => a.n - b.n), pending: saved.pending, deleted: saved.deleted };
  } catch {
    return empty;
  }
}

const noop = () => () => {};

export function LiveScorer(props: Props) {
  // solo nel browser: lo stato parte da quello salvato sul dispositivo
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return <p className="py-10 text-center text-sm text-muted">Caricamento…</p>;
  return <Scorer {...props} />;
}

function Scorer({ game: initialGame, initialEvents, ownName, opponentName, photos }: Props) {
  const db = browserClient();
  const [restored] = useState(() => restore(initialGame.id, initialEvents));
  const [game, setGame] = useState(initialGame);
  const [events, setEvents] = useState<LiveEvent[]>(restored.events);
  const [pendingIds, setPendingIds] = useState<string[]>(restored.pending);
  const [deletedIds, setDeletedIds] = useState<string[]>(restored.deleted);
  const [gameDirty, setGameDirty] = useState(false);
  const [online, setOnline] = useState(true);
  const [action, setAction] = useState<Pending>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [brickOpen, setBrickOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  // cambio di quarto premuto per sbaglio: si torna al periodo prima con il suo tempo
  const [periodUndo, setPeriodUndo] = useState<{ period: number; clock_remaining: number } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [, tick] = useState(0);

  const updateGame = (patch: Partial<ScorerGame>) => {
    setGame((g) => ({ ...g, ...patch, clock_updated_at: new Date().toISOString() }));
    setGameDirty(true);
  };

  useEffect(() => {
    try {
      localStorage.setItem(store(game.id), JSON.stringify({ events, pending: pendingIds, deleted: deletedIds }));
    } catch {
      /* spazio esaurito o navigazione privata: resta l'invio diretto */
    }
  }, [game.id, events, pendingIds, deletedIds]);

  // invio al database ogni secondo e mezzo (si riprova finché non va)
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let ok = true;
      if (pendingIds.length) {
        const rows = events.filter((e) => pendingIds.includes(e.id)).map((e) => ({ ...e, game_id: game.id }));
        const { error } = rows.length ? await db.from("live_events").upsert(rows) : { error: null };
        if (error) ok = false;
        else setPendingIds((p) => p.filter((id) => !rows.some((r) => r.id === id)));
      }
      if (deletedIds.length) {
        const { error } = await db.from("live_events").delete().in("id", deletedIds);
        if (error) ok = false;
        else setDeletedIds((d) => d.filter((id) => !deletedIds.includes(id)));
      }
      if (gameDirty) {
        const { error } = await db
          .from("live_games")
          .update({
            status: game.status,
            period: game.period,
            clock_remaining: game.clock_remaining,
            clock_running: game.clock_running,
            clock_updated_at: game.clock_updated_at,
          })
          .eq("id", game.id);
        if (error) ok = false;
        else setGameDirty(false);
      }
      setOnline(ok);
    } finally {
      flushing.current = false;
    }
  }, [db, events, pendingIds, deletedIds, gameDirty, game]);

  useEffect(() => {
    const t = setInterval(() => void flush(), 1500);
    return () => clearInterval(t);
  }, [flush]);

  // orologio: ridisegno mentre scorre, stop automatico a fine periodo
  const remaining = clockNow(game);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    if (!game.clock_running) return;
    const t = setInterval(() => {
      if (clockNow(gameRef.current) <= 0) {
        setGame((g) => ({ ...g, clock_running: false, clock_remaining: 0, clock_updated_at: new Date().toISOString() }));
        setGameDirty(true);
      } else tick((x) => x + 1);
    }, 250);
    return () => clearInterval(t);
  }, [game.clock_running]);

  const clockUsed = events.some((e) => e.clock !== null) || game.clock_running || game.clock_remaining !== game.period_seconds || game.period > 1;
  const add = (items: (Omit<LiveEvent, "id" | "n" | "period" | "clock" | "brick"> & { brick?: boolean })[]) => {
    let n = events.reduce((m, e) => Math.max(m, e.n), 0);
    const clock = clockUsed || game.clock_running ? clockNow(game) : null;
    const created = items.map((it) => ({ ...it, id: newId(), n: ++n, period: game.period, clock }));
    setEvents((e) => [...e, ...created]);
    setPendingIds((p) => [...p, ...created.map((c) => c.id)]);
    if (navigator.vibrate) navigator.vibrate(15);
  };
  const remove = (id: string) => {
    setEvents((e) => e.filter((x) => x.id !== id));
    if (pendingIds.includes(id)) setPendingIds((p) => p.filter((x) => x !== id));
    else setDeletedIds((d) => [...d, id]);
  };

  const s = useMemo(
    () => summarize(events, game.roster, { period: game.period, periods: game.periods, periodSeconds: game.period_seconds, remaining }),
    [events, game.roster, game.period, game.periods, game.period_seconds, remaining],
  );
  const onCourt = game.roster.filter((r) => s.onCourt.includes(r.player_id));
  const bench = game.roster.filter((r) => !s.onCourt.includes(r.player_id));
  const nameOf = (id: string | null) => game.roster.find((r) => r.player_id === id);
  const brickEvents = events.filter((e) => e.brick).sort((a, b) => a.n - b.n);

  const pick = (playerId: string | null, team: "own" | "opp") => {
    if (!action) return;
    add([{ kind: action.kind, made: action.made, team, player_id: playerId, ...(action.brick ? { brick: true } : {}) }]);
    setAction(null);
  };

  const ask = (kind: LiveKind, made: boolean | null = null, brick = false) => {
    if (onCourt.length === 0) {
      setSubOpen(true);
      return;
    }
    // fallo: l'arbitro fischia, il tempo si ferma subito
    if (kind === "foul" && game.clock_running) updateGame({ clock_running: false, clock_remaining: remaining });
    setAction({
      kind,
      made,
      brick,
      label: brick ? `🧱 Loud ass brick · ${{ "1pt": "tiro libero", "2pt": "da 2", "3pt": "da 3" }[kind as "1pt"]}` : `${ACTION_LABEL[kind]}${made === true ? " segnato" : made === false ? " sbagliato" : ""}`,
    });
  };

  const save = async () => {
    setSaving("Salvataggio…");
    await flush();
    const res = await saveLiveBoxScore(game.id);
    setSaving(res.message);
    if (res.ok) {
      setGame((g) => ({ ...g, status: "saved" }));
      try {
        localStorage.removeItem(store(game.id));
      } catch {
        /* ok */
      }
    }
  };

  const finished = game.status !== "live";
  const lastPeriod = game.period >= game.periods;

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-6">
      {/* tabellone */}
      <div className="glow-panel rounded-3xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <Team name={ownName} score={s.score.own} fouls={s.teamFouls.own} own />
          <div className="text-center">
            <button
              type="button"
              onClick={() => !finished && updateGame({ clock_running: !game.clock_running, clock_remaining: remaining })}
              className={cx(
                "display rounded-2xl px-4 py-1 text-5xl tabular-nums leading-none ring-2 transition-colors sm:text-6xl",
                game.clock_running ? "text-primary ring-primary/60" : "text-text/80 ring-white/15",
              )}
              aria-label={game.clock_running ? "Ferma l'orologio" : "Fai partire l'orologio"}
            >
              {formatClock(remaining)}
            </button>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-text/70">{periodLabel(game.period, game.periods)}</p>
            {!game.clock_running && !finished && (
              <div className="mt-1 flex justify-center gap-1">
                {[-60, -10, 10, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateGame({ clock_remaining: Math.max(0, Math.min(game.period_seconds, remaining + d)) })}
                    className="rounded-md bg-black/30 px-1.5 py-0.5 text-[0.65rem] font-semibold text-text/80"
                  >
                    {d > 0 ? `+${d}` : d}s
                  </button>
                ))}
              </div>
            )}
          </div>
          <Team name={opponentName} score={s.score.opp} fouls={s.teamFouls.opp} />
        </div>
        <p className={cx("mt-3 text-center text-[0.7rem]", online && !pendingIds.length && !deletedIds.length ? "text-text/50" : "text-secondary")}>
          {online
            ? pendingIds.length || deletedIds.length
              ? "Invio in corso…"
              : "Tutto salvato · visibile in diretta"
            : `Senza rete: ${pendingIds.length + deletedIds.length} azioni salvate sul telefono, verranno inviate appena torna la connessione`}
        </p>
      </div>

      {/* in campo */}
      <div className="flex flex-wrap items-center gap-2">
        {onCourt.map((r) => {
          const l = s.players.get(r.player_id)!;
          return (
            <span key={r.player_id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-xs">
              <span className="display text-sm text-secondary">#{r.jersey}</span>
              {r.name} · {l.points} pt
              <FoulBadge fouls={l.pf ?? 0} />
            </span>
          );
        })}
        <button type="button" onClick={() => setSubOpen(true)} disabled={finished} className="rounded-full border border-primary/60 px-3 py-1 text-xs font-semibold text-primary disabled:opacity-40">
          {onCourt.length ? "Cambio" : "Quintetto iniziale"}
        </button>
        <button type="button" onClick={() => setStatsOpen(true)} className="rounded-full border border-sky/60 bg-sky/10 px-3 py-1 text-xs font-semibold text-sky">
          📊 Statistiche
        </button>
      </div>

      {/* pulsanti */}
      <fieldset disabled={finished} className="grid grid-cols-2 gap-3 disabled:opacity-40 sm:grid-cols-[1fr_1.4fr]">
        <div className="grid grid-cols-2 gap-2">
          {(["2pt", "3pt", "1pt"] as const).map((k) => (
            <ShotPair key={k} label={k === "1pt" ? "TL" : k.replace("pt", " PT")} onMade={() => ask(k, true)} onMiss={() => ask(k, false)} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* righe: rimbalzi · assist e stoppata · recupero e persa · fallo e cambio */}
          {(["dreb", "oreb", "ast", "blk", "stl", "tov", "foul"] as const).map((k) => (
            <BigButton key={k} onClick={() => ask(k)} tone={k === "foul" ? "danger" : k === "tov" ? "orange" : "plain"} icon={ACTION_ICON[k]}>
              {{ dreb: "Rimb. dif.", oreb: "Rimb. off.", ast: "Assist", stl: "Recupero", tov: "Persa", blk: "Stoppata", foul: "Fallo" }[k]}
            </BigButton>
          ))}
          <BigButton onClick={() => setSubOpen(true)} tone="accent" icon={<IconSub />}>
            Cambio
          </BigButton>
        </div>
        <button
          type="button"
          onClick={() => (onCourt.length ? setBrickOpen(true) : setSubOpen(true))}
          className="press col-span-2 flex min-h-14 items-center justify-center gap-3 rounded-2xl border-2 border-loss bg-loss/80 px-4 font-bold text-white shadow-[0_6px_20px_-8px_rgba(239,68,68,0.8)]"
        >
          <span className="text-2xl">🧱</span>
          <span className="display text-2xl tracking-wide">Loud ass brick</span>
          <span className="display grid min-w-9 place-items-center rounded-full bg-black/35 px-2 text-2xl tabular-nums">{s.bricks.total}</span>
        </button>
      </fieldset>

      {/* il muro dei brick: una cosa nostra, fuori dalle statistiche */}
      {brickEvents.length > 0 && (
        <button type="button" onClick={() => setWallOpen(true)} className="block w-full text-left" aria-label="Apri il muro dei brick">
          <BrickWall bricks={brickEvents.map((e) => ({ id: e.id, name: e.team === "opp" ? "Avv." : (nameOf(e.player_id)?.name ?? "?") }))} />
        </button>
      )}

      {/* registro */}
      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Registro</p>
          {events.length > 0 && !finished && (
            <button type="button" onClick={() => remove(events.at(-1)!.id)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
              ↶ Annulla ultima
            </button>
          )}
        </div>
        <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
          {[...events].reverse().slice(0, 30).map((e) => {
            const p = nameOf(e.player_id);
            return (
              <li key={e.id} className={cx("flex items-center gap-2 rounded-lg px-2 py-1 odd:bg-surface-2/50", (e.kind === "foul" || e.brick) && "text-loss")}>
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted">
                  Q{e.period} {e.clock !== null ? formatClock(e.clock) : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {e.brick ? "🧱 " : ""}
                  {e.team === "opp" ? opponentName : p ? `#${p.jersey} ${p.name}` : "?"} · {ACTION_LABEL[e.kind]}
                  {e.made === true ? " ✓" : e.made === false ? " ✗" : ""}
                </span>
                {!finished && (
                  <button type="button" onClick={() => remove(e.id)} aria-label="Elimina" className="px-1 text-muted hover:text-loss">
                    ×
                  </button>
                )}
              </li>
            );
          })}
          {events.length === 0 && <li className="text-muted">Scegli il quintetto iniziale e fai partire l&apos;orologio.</li>}
        </ul>
      </div>

      {/* periodo e fine partita */}
      {!finished ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const next = game.period + 1;
              const len = next > game.periods ? 300 : game.period_seconds;
              setPeriodUndo({ period: game.period, clock_remaining: remaining });
              updateGame({ period: next, clock_remaining: len, clock_running: false });
            }}
            className="flex-1 rounded-full border border-border px-4 py-3 text-sm font-semibold"
          >
            {lastPeriod ? "Supplementare" : `Inizia ${periodLabel(game.period + 1, game.periods)}`}
          </button>
          <button type="button" onClick={() => setConfirmEnd(true)} className="flex-1 rounded-full border border-loss/50 px-4 py-3 text-sm font-semibold text-loss">
            Termina partita
          </button>
          {/* periodo cambiato per sbaglio: finché nel nuovo periodo non c'è nessuna azione si può tornare indietro */}
          {game.period > 1 && !events.some((e) => e.period === game.period) && (
            <button
              type="button"
              onClick={() => {
                const prev = game.period - 1;
                const lastClock = [...events].reverse().find((e) => e.period === prev && e.clock !== null)?.clock ?? 0;
                updateGame({
                  period: prev,
                  clock_remaining: periodUndo?.period === prev ? periodUndo.clock_remaining : lastClock,
                  clock_running: false,
                });
                setPeriodUndo(null);
              }}
              className="w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-text/80"
            >
              ↶ Torna al {periodLabel(game.period - 1, game.periods)}
            </button>
          )}
        </div>
      ) : (
        <div className="card space-y-3 p-4 text-center">
          <p className="display text-3xl">
            Finale {s.score.own}–{s.score.opp}
          </p>
          {game.status === "saved" ? (
            <Link href={`/partite/${game.match_id}`} className="inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
              Vai alla partita
            </Link>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={save} disabled={saving === "Salvataggio…"} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-ink">
                Salva box score
              </button>
              <button type="button" onClick={() => updateGame({ status: "live" })} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold">
                Riapri
              </button>
            </div>
          )}
          {saving && <p className="text-sm text-muted">{saving}</p>}
        </div>
      )}

      {/* scelta del giocatore */}
      {action && (
        <Sheet title={action.label} onClose={() => setAction(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {onCourt.map((r) => (
              <PlayerTile key={r.player_id} r={r} photo={photos[r.player_id]} big fouls={s.players.get(r.player_id)?.pf ?? 0} onClick={() => pick(r.player_id, "own")} />
            ))}
            {action.kind !== "ast" && (
              <button type="button" onClick={() => pick(null, "opp")} className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border-2 border-loss/50 bg-loss/10 p-2 text-center font-semibold">
                <span className="text-4xl">⛹</span>
                <span className="mt-1 line-clamp-2 text-base">{opponentName}</span>
              </button>
            )}
          </div>
        </Sheet>
      )}

      {/* cambi */}
      {subOpen && (
        <Substitution
          onCourt={onCourt}
          bench={bench}
          photos={photos}
          onClose={() => setSubOpen(false)}
          onConfirm={(outs, ins) => {
            add([...outs.map((id) => ({ kind: "out" as const, made: null, team: "own" as const, player_id: id })), ...ins.map((id) => ({ kind: "in" as const, made: null, team: "own" as const, player_id: id }))]);
            setSubOpen(false);
          }}
        />
      )}

      {brickOpen && (
        <Sheet title="🧱 Loud ass brick: che tiro?" onClose={() => setBrickOpen(false)}>
          <p className="mb-3 text-sm text-muted">Conta come un tiro sbagliato normale, più un mattone nel contatore.</p>
          <div className="grid grid-cols-3 gap-3">
            {(["1pt", "2pt", "3pt"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setBrickOpen(false);
                  ask(k, false, true);
                }}
                className="press aspect-[4/3] rounded-2xl border-2 border-loss/70 bg-loss/15 text-center"
              >
                <span className="display block text-4xl leading-none text-loss">{k === "1pt" ? "TL" : k.replace("pt", " PT")}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {wallOpen && (
        <Sheet title={`🧱 Il muro · ${brickEvents.length} ${brickEvents.length === 1 ? "mattone" : "mattoni"}`} closeLabel="Chiudi" onClose={() => setWallOpen(false)}>
          <WallBuilders bricks={brickEvents} roster={game.roster} photos={photos} opponentName={opponentName} />
        </Sheet>
      )}

      {statsOpen && (
        <Sheet title="Statistiche" wide closeLabel="Chiudi" onClose={() => setStatsOpen(false)}>
          <LiveStatsTable s={s} roster={game.roster} opponentName={opponentName} />
        </Sheet>
      )}

      {confirmEnd && (
        <Sheet title="Terminare la partita?" onClose={() => setConfirmEnd(false)}>
          <p className="mb-4 text-sm text-muted">
            L&apos;orologio si ferma e la diretta mostra il risultato finale. Poi salvi il box score; se serve correggere qualcosa puoi
            riaprirla.
          </p>
          <button
            type="button"
            onClick={() => {
              updateGame({ status: "finished", clock_running: false, clock_remaining: remaining });
              setConfirmEnd(false);
            }}
            className="w-full rounded-full bg-loss px-4 py-3 text-sm font-semibold text-white"
          >
            Termina partita
          </button>
        </Sheet>
      )}
    </div>
  );
}

function Team({ name, score, fouls, own }: { name: string; score: number; fouls: number; own?: boolean }) {
  return (
    <div className={cx("min-w-0 flex-1", !own && "text-right")}>
      <p className={cx("truncate text-xs font-semibold uppercase tracking-wider", own ? "text-primary" : "text-text/80")}>{name}</p>
      <p className="display text-6xl leading-none tabular-nums sm:text-7xl">{score}</p>
      <p className={cx("text-[0.7rem]", fouls >= 4 ? "font-semibold text-loss" : "text-text/60")}>Falli nel periodo: {fouls}</p>
    </div>
  );
}

function ShotPair({ label, onMade, onMiss }: { label: string; onMade: () => void; onMiss: () => void }) {
  return (
    <>
      <button type="button" onClick={onMade} className="press aspect-[5/4] rounded-2xl border-2 border-primary/70 bg-primary/10 text-center">
        <span className="display block text-3xl leading-none text-primary">{label}</span>
        <span className="text-xs font-semibold text-primary/80">segnato</span>
      </button>
      <button type="button" onClick={onMiss} className="press aspect-[5/4] rounded-2xl border-2 border-loss/60 bg-loss/10 text-center">
        <span className="display block text-3xl leading-none text-loss">{label}</span>
        <span className="text-xs font-semibold text-loss/80">sbagliato</span>
      </button>
    </>
  );
}

/** Falli del giocatore: in evidenza man mano che si avvicina al quinto. */
function FoulBadge({ fouls }: { fouls: number }) {
  return (
    <span
      title={`${fouls} falli`}
      className={cx(
        "rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold tabular-nums",
        fouls >= 5 ? "bg-loss text-white" : fouls === 4 ? "bg-loss/80 text-white" : fouls === 3 ? "bg-secondary/25 text-secondary" : "bg-black/30 text-text/70",
      )}
    >
      {fouls} F
    </span>
  );
}

function BigButton({ children, onClick, tone, icon }: { children: ReactNode; onClick: () => void; tone: "plain" | "warn" | "accent" | "danger" | "orange"; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "press min-h-16 rounded-2xl border-2 px-2 text-sm font-semibold",
        icon ? "flex min-h-[4.75rem] flex-col items-center justify-center gap-1 py-2" : null,
        tone === "danger"
          ? "border-loss/80 bg-loss/15 text-loss"
          : tone === "orange"
            ? "border-accent/80 bg-accent/10 text-accent"
            : tone === "warn"
              ? "border-secondary/50 text-secondary"
              : tone === "accent"
                ? "border-sky/60 bg-sky/10 text-sky"
                : "border-border bg-surface-2/60",
      )}
    >
      {icon && <span className="opacity-90">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

function PlayerTile({
  r,
  photo,
  onClick,
  selected,
  big,
  fouls,
}: {
  r: LiveRosterEntry;
  photo?: string | null;
  onClick: () => void;
  selected?: boolean;
  /** riquadro grande (scelta del giocatore per un'azione) */
  big?: boolean;
  fouls?: number;
}) {
  const url = publicMediaUrl(photo ?? null);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative flex flex-col items-center justify-end overflow-hidden rounded-2xl border-2 text-center",
        big ? "aspect-[4/3] p-2" : "aspect-square p-1.5",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- foto della stagione
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_25%] opacity-70" />
      )}
      {fouls !== undefined && (
        <span className="absolute right-1.5 top-1.5">
          <FoulBadge fouls={fouls} />
        </span>
      )}
      <span className={cx("relative rounded-lg bg-black/60", big ? "px-2.5 py-1" : "px-1.5 py-0.5")}>
        <span className={cx("display block leading-none text-white", big ? "text-5xl" : "text-2xl")}>#{r.jersey}</span>
        <span className={cx("block max-w-full truncate font-semibold text-white", big ? "text-base" : "text-xs")}>{r.name}</span>
      </span>
    </button>
  );
}

/**
 * Il muro dei "loud ass brick": un mattone per ogni brick, in file sfalsate come un muro vero,
 * con il nome di chi l'ha tirato. Cresce dal basso.
 */
function BrickWall({ bricks }: { bricks: { id: string; name: string }[] }) {
  const PER_ROW = 5;
  const rows: { id: string; name: string }[][] = [];
  for (let i = 0; i < bricks.length; i += PER_ROW) rows.push(bricks.slice(i, i + PER_ROW));
  return (
    <div className="rounded-2xl border border-loss/30 bg-[#1a0f0c] p-3">
      <div className="flex flex-col-reverse gap-1">
        {rows.map((row, r) => (
          <div key={r} className={cx("flex gap-1", r % 2 === 1 && "pl-[10%]")}>
            {row.map((b) => (
              <span
                key={b.id}
                className="flex h-8 w-[19%] shrink-0 items-center justify-center overflow-hidden rounded-[3px] border-b-2 border-r-2 border-[#5c2412] bg-gradient-to-b from-[#c4562f] to-[#9b3a1d] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] motion-safe:animate-[sg-rise_0.3s_ease-out]"
              >
                <span className="truncate text-[0.62rem] font-bold uppercase tracking-wide text-white/85">{b.name}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[0.7rem] text-text/50">Tocca il muro per vedere chi l&apos;ha costruito</p>
    </div>
  );
}

/** Chi ha costruito il muro: figurina e numero di mattoni, dal più "generoso". */
function WallBuilders({
  bricks,
  roster,
  photos,
  opponentName,
}: {
  bricks: LiveEvent[];
  roster: LiveRosterEntry[];
  photos: Record<string, string | null>;
  opponentName: string;
}) {
  const counts = new Map<string, number>();
  for (const b of bricks) {
    const key = b.team === "opp" ? "opp" : (b.player_id ?? "?");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid max-h-[65dvh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
      {list.map(([key, n]) => {
        const r = roster.find((x) => x.player_id === key);
        const url = key === "opp" ? null : publicMediaUrl(photos[key] ?? null);
        return (
          <div key={key} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-loss/40 bg-surface-2">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- figurina della stagione
              <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_25%]" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-5xl">{key === "opp" ? "⛹" : "🧱"}</span>
            )}
            <span className="display absolute right-2 top-2 rounded-xl bg-loss px-2 pt-0.5 text-2xl leading-none text-white shadow">
              🧱 {n}
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-8">
              <span className="block truncate text-sm font-bold text-white">{key === "opp" ? opponentName : r ? `#${r.jersey} ${r.name}` : "?"}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Statistiche della partita in corso: chi è in campo, minuti, punti, falli e il resto. */
function LiveStatsTable({ s, roster, opponentName }: { s: ReturnType<typeof summarize>; roster: LiveRosterEntry[]; opponentName: string }) {
  // riga toccata: si illumina tutta, per leggere al volo i numeri di un giocatore
  const [picked, setPicked] = useState<string | null>(null);
  const rows = roster
    .map((r) => ({ r, l: s.players.get(r.player_id)!, on: s.onCourt.includes(r.player_id) }))
    .filter((x) => x.l)
    .sort((a, b) => Number(b.on) - Number(a.on) || (b.l.points ?? 0) - (a.l.points ?? 0));
  const ma = (m: number | null | undefined, a: number | null | undefined) => `${m ?? 0}/${a ?? 0}`;
  const head = ["MIN", "PTS", "F", "TIRI", "3P", "TL", "RT", "AST", "REC", "PP", "STP", "+/-"];
  const cells = (l: ReturnType<typeof summarize>["own"], withMinutes: boolean) => [
    withMinutes && s.usesClock ? formatMinutes(l.minutes) : "",
    String(l.points ?? 0),
    String(l.pf ?? 0),
    ma(l.fgm, l.fga),
    ma(l.fg3m, l.fg3a),
    ma(l.ftm, l.fta),
    String(l.reb ?? 0),
    String(l.ast ?? 0),
    String(l.stl ?? 0),
    String(l.tov ?? 0),
    String(l.blk ?? 0),
    l.plus_minus === null ? "" : formatSigned(l.plus_minus),
  ];
  return (
    <div className="-mx-4 max-h-[70dvh] overflow-auto px-4">
      <table className="w-full min-w-[44rem] text-sm tabular-nums">
        <thead className="sticky top-0 bg-surface text-[0.7rem] uppercase tracking-wider text-muted">
          <tr>
            <th className="py-2 pr-2 text-left">Giocatore</th>
            {head.map((h) => (
              <th key={h} className="px-1.5 py-2 text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, l, on }) => (
            <tr
              key={r.player_id}
              onClick={() => setPicked((p) => (p === r.player_id ? null : r.player_id))}
              aria-selected={picked === r.player_id}
              className={cx(
                "cursor-pointer border-t border-border/50 transition-colors",
                picked === r.player_id ? "bg-primary/20 text-text outline outline-2 -outline-offset-2 outline-primary/70" : !on && !l.entered && "text-muted",
              )}
            >
              <td className={cx("py-2 pr-2", picked === r.player_id && "rounded-l-lg")}>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  {on && <span className="size-2 rounded-full bg-primary" title="In campo" />}
                  <span className="display text-base text-secondary">#{r.jersey}</span>
                  <span className="font-semibold">{r.name}</span>
                </span>
              </td>
              {cells(l, true).map((c, i) => (
                <td
                  key={i}
                  className={cx(
                    "px-1.5 py-2 text-right",
                    head[i] === "PTS" && "font-bold",
                    head[i] === "F" && (l.pf ?? 0) >= 4 && "font-bold text-loss",
                    head[i] === "F" && (l.pf ?? 0) === 3 && "font-semibold text-secondary",
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-border font-semibold">
            <td className="py-2 pr-2">Squadra</td>
            {cells(s.own, false).map((c, i) => (
              <td key={i} className="px-1.5 py-2 text-right">
                {c}
              </td>
            ))}
          </tr>
          <tr className="border-t border-border/50 text-text/80">
            <td className="max-w-[9rem] truncate py-2 pr-2">{opponentName}</td>
            {cells(s.opponent, false).map((c, i) => (
              <td key={i} className="px-1.5 py-2 text-right">
                {c}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Il pallino verde indica chi è in campo. Falli: giallo a 3, rosso da 4.</p>
    </div>
  );
}

function Sheet({ title, children, onClose, wide, closeLabel = "Annulla" }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; closeLabel?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div
        className={cx("w-full rounded-3xl border border-border bg-surface p-4 shadow-2xl motion-safe:animate-[sg-menu-in_0.16s_ease-out]", wide ? "max-w-5xl" : "max-w-2xl")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="display text-2xl">{title}</p>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-muted">
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Substitution({
  onCourt,
  bench,
  photos,
  onClose,
  onConfirm,
}: {
  onCourt: LiveRosterEntry[];
  bench: LiveRosterEntry[];
  photos: Record<string, string | null>;
  onClose: () => void;
  onConfirm: (outs: string[], ins: string[]) => void;
}) {
  const [outs, setOuts] = useState<string[]>([]);
  const [ins, setIns] = useState<string[]>([]);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const after = onCourt.length - outs.length + ins.length;
  const valid = ins.length > 0 && after <= 5 && (onCourt.length < 5 ? true : outs.length === ins.length);
  return (
    <Sheet title={onCourt.length ? "Cambio" : "Quintetto iniziale"} onClose={onClose}>
      {onCourt.length > 0 && (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Escono</p>
          <div className="mb-4 grid grid-cols-5 gap-2">
            {onCourt.map((r) => (
              <PlayerTile key={r.player_id} r={r} photo={photos[r.player_id]} selected={outs.includes(r.player_id)} onClick={() => toggle(outs, setOuts, r.player_id)} />
            ))}
          </div>
        </>
      )}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{onCourt.length ? "Entrano" : "Scegli i 5 in campo"}</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {bench.map((r) => (
          <PlayerTile key={r.player_id} r={r} photo={photos[r.player_id]} selected={ins.includes(r.player_id)} onClick={() => toggle(ins, setIns, r.player_id)} />
        ))}
      </div>
      <button
        type="button"
        disabled={!valid}
        onClick={() => onConfirm(outs, ins)}
        className="mt-4 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-ink disabled:opacity-40"
      >
        {onCourt.length ? `Conferma cambio (${outs.length} ↔ ${ins.length})` : `Conferma quintetto (${ins.length}/5)`}
      </button>
    </Sheet>
  );
}
