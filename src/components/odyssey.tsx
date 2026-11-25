"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Giocatore lontano per un po' (J, a Itaca a studiare): nella pagina Squadra è un "personaggio da
 * sbloccare" (sagoma nera con il "?"). Toccandola parte "L'Odissea": Polifemo, le Sirene, Scilla e
 * Cariddi e il tiro finale a Bologna. Vinta l'Odissea, la figurina si sblocca su quel telefono.
 */

const key = (slug: string) => `sg-sbloccato-${slug}`;
const EVENT = "sg-sbloccato";
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function LockedPlayer({ slug, name, silhouette, photo, unlocked: unlockedCard }: { slug: string; name: string; silhouette: string; photo: string | null; unlocked: ReactNode }) {
  const unlocked = useSyncExternalStore(subscribe, () => read(key(slug)) === "1", () => false);
  const [open, setOpen] = useState(false);
  const win = useCallback(() => {
    try {
      localStorage.setItem(key(slug), "1");
    } catch {
      /* navigazione privata: vale solo per questa visita */
    }
    window.dispatchEvent(new Event(EVENT));
  }, [slug]);

  if (unlocked && !open) return <>{unlockedCard}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Personaggio da sbloccare: gioca all'Odissea"
        className="glow-panel lift group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border text-left hover:border-primary/60"
      >
        <span aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(75,227,138,0.22),transparent_65%)]" />
        {/* eslint-disable-next-line @next/next/no-img-element -- sagoma su Supabase Storage */}
        <img
          src={silhouette}
          alt=""
          className="absolute inset-0 h-full w-full object-contain object-bottom transition-transform duration-500 [filter:drop-shadow(0_0_2px_rgba(75,227,138,0.95))_drop-shadow(0_0_16px_rgba(75,227,138,0.45))] group-hover:scale-[1.03]"
        />
        <span aria-hidden className="display absolute inset-x-0 top-[16%] text-center text-[7rem] leading-none text-primary [text-shadow:0_0_24px_rgba(75,227,138,0.8)] motion-safe:animate-pulse">
          ?
        </span>
        <span aria-hidden className="absolute right-2 top-2 rounded-xl bg-black/30 px-2.5 py-1.5 text-2xl ring-1 ring-white/20 backdrop-blur-md">
          🔒
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-12">
          <span className="display block text-3xl leading-[0.9] text-text/80 group-hover:text-primary">???</span>
        </span>
      </button>
      {open && createPortal(<Odyssey name={name} photo={photo} onWin={win} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/* ---------------------------------------------------------------- il gioco */

type Stage = "map" | "polifemo" | "sirene" | "scilla" | "finale" | "win";
const STOPS: { stage: Stage; label: string; x: number; y: number }[] = [
  { stage: "polifemo", label: "Isola dei Ciclopi", x: 230, y: 118 },
  { stage: "sirene", label: "Scoglio delle Sirene", x: 160, y: 86 },
  { stage: "scilla", label: "Scilla e Cariddi", x: 95, y: 112 },
  { stage: "finale", label: "Bologna", x: 40, y: 40 },
];
const ORDER: Stage[] = ["map", "polifemo", "sirene", "scilla", "finale", "win"];

function Odyssey({ name, photo, onWin, onClose }: { name: string; photo: string | null; onWin: () => void; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("map");
  const [reached, setReached] = useState(0); // tappe superate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const done = () => {
    const next = ORDER[ORDER.indexOf(stage) + 1];
    setReached((r) => r + 1);
    if (next === "win") onWin();
    setStage(next === "win" ? "win" : "map");
  };
  const nextStop = STOPS[reached];

  return (
    <div role="dialog" aria-modal="true" aria-label="L'Odissea" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-primary">Itaca → Bologna</p>
            <h2 className="display text-3xl leading-none">L&apos;Odissea di {name}</h2>
          </div>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20">
            ×
          </button>
        </div>

        {stage === "map" && (
          <div className="mt-3">
            <SeaMap reached={reached} />
            <p className="mt-3 text-sm text-muted">
              {reached === 0
                ? `${name} è a Itaca a studiare e deve tornare a casa a giocare. Supera le tappe del viaggio e sbloccalo.`
                : `Tappa superata! Prossima: ${nextStop.label}.`}
            </p>
            <button type="button" onClick={() => setStage(nextStop.stage)} className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-ink transition active:scale-[0.98]">
              {reached === 0 ? "Salpa! ⛵" : "Riparti ⛵"}
            </button>
          </div>
        )}
        {stage === "polifemo" && <Polifemo name={name} onDone={done} />}
        {stage === "sirene" && <Sirene onDone={done} />}
        {stage === "scilla" && <Scilla onDone={done} />}
        {stage === "finale" && <Finale name={name} onDone={done} />}
        {stage === "win" && <Win name={name} photo={photo} onClose={onClose} />}
      </div>
    </div>
  );
}

/** Mappa del viaggio: Itaca a destra in basso, Bologna in alto a sinistra. */
function SeaMap({ reached }: { reached: number }) {
  const pts = [{ x: 280, y: 150 }, ...STOPS];
  const ship = pts[reached];
  return (
    <svg viewBox="0 0 320 180" className="w-full rounded-2xl bg-gradient-to-b from-[#0b2a3a] to-[#0d4a5c]">
      {[30, 70, 110, 150].map((y) => (
        <path key={y} d={`M0 ${y} q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0`} fill="none" stroke="#5fd3e0" strokeOpacity={0.15} strokeWidth={1.5} />
      ))}
      <path d={pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")} fill="none" stroke="#f6f2ec" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="4 6" />
      <text x={280} y={172} textAnchor="middle" fontSize={11} fill="#f6f2ec" opacity={0.8}>
        Itaca
      </text>
      {STOPS.map((s, i) => (
        <g key={s.label}>
          <circle cx={s.x} cy={s.y} r={9} fill={i < reached ? "#4be38a" : "#0b2a3a"} stroke="#4be38a" strokeWidth={2} />
          <text x={s.x} y={s.y + (s.y < 60 ? 22 : -14)} textAnchor="middle" fontSize={10} fill="#f6f2ec" opacity={0.85}>
            {s.label}
          </text>
        </g>
      ))}
      <text x={ship.x} y={ship.y + 6} textAnchor="middle" fontSize={20}>
        ⛵
      </text>
    </svg>
  );
}

const Hint = ({ children }: { children: ReactNode }) => <p className="mt-2 min-h-10 text-sm text-muted">{children}</p>;
const Dots = ({ n, of }: { n: number; of: number }) => (
  <span className="flex gap-1.5" aria-label={`${n} su ${of}`}>
    {Array.from({ length: of }, (_, i) => (
      <span key={i} className={`size-3 rounded-full ${i < n ? "bg-win" : "border border-border"}`} />
    ))}
  </span>
);
const Title = ({ title, n, of }: { title: string; n: number; of: number }) => (
  <div className="mt-3 flex items-center justify-between gap-2">
    <p className="font-semibold">{title}</p>
    <Dots n={n} of={of} />
  </div>
);
const Btn = ({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled} className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-ink transition active:scale-[0.98] disabled:opacity-50">
    {children}
  </button>
);

/* ---------- 1. Polifemo: si tira quando chiude l'occhio ---------- */
function Polifemo({ name, onDone }: { name: string; onDone: () => void }) {
  const NEED = 2;
  const [eye, setEye] = useState(true); // occhio aperto
  const [made, setMade] = useState(0);
  const [msg, setMsg] = useState(`Polifemo stoppa tutto quello che vede. Tira quando chiude l'occhio!`);
  const [flash, setFlash] = useState<"ok" | "ko" | null>(null);
  const eyeRef = useRef(true);
  useEffect(() => {
    let t: number;
    const loop = (open: boolean) => {
      eyeRef.current = open;
      setEye(open);
      // aperto a lungo, chiuso per un attimo (sempre più breve)
      t = window.setTimeout(() => loop(!open), open ? 900 + Math.random() * 1500 : 520 - made * 90);
    };
    loop(true);
    return () => window.clearTimeout(t);
  }, [made]);
  const shoot = () => {
    if (flash) return;
    if (!eyeRef.current) {
      const n = made + 1;
      setFlash("ok");
      setMsg(n >= NEED ? "Canestro! Polifemo non ha visto niente. Via dall'isola!" : "Canestro! Non ti ha visto. Ancora uno.");
      window.setTimeout(() => {
        setFlash(null);
        if (n >= NEED) onDone();
        else setMade(n);
      }, 900);
    } else {
      setFlash("ko");
      setMsg(`Stoppata! Polifemo ti ha visto. ${name} ricomincia da capo.`);
      window.setTimeout(() => {
        setFlash(null);
        setMade(0);
      }, 900);
    }
  };
  return (
    <div>
      <Title title="L'isola dei Ciclopi" n={made} of={NEED} />
      <button type="button" onClick={shoot} className="mt-3 block w-full" aria-label="Tira">
        <svg viewBox="0 0 300 260" className="w-full rounded-2xl bg-gradient-to-b from-[#3a2a1a] to-[#6b4a2a]">
          {/* canestro dietro al gigante */}
          <rect x={110} y={14} width={80} height={52} rx={3} fill="#f6efe9" opacity={0.9} />
          <ellipse cx={150} cy={70} rx={22} ry={5} fill="none" stroke="#e5482b" strokeWidth={4} />
          {/* Polifemo */}
          <ellipse cx={150} cy={190} rx={95} ry={85} fill="#c98f6a" />
          <path d="M70 150 Q150 90 230 150" fill="none" stroke="#4a2e1a" strokeWidth={16} strokeLinecap="round" />
          {eye ? (
            <g>
              <circle cx={150} cy={175} r={34} fill="#fff" />
              <circle cx={150} cy={178} r={15} fill="#2b6cb0" />
              <circle cx={150} cy={178} r={7} fill="#111" />
            </g>
          ) : (
            <path d="M118 178 Q150 198 182 178" fill="none" stroke="#3b1d00" strokeWidth={6} strokeLinecap="round" />
          )}
          <path d="M120 232 Q150 248 180 232" fill="none" stroke="#3b1d00" strokeWidth={5} strokeLinecap="round" />
          <text x={150} y={flash === "ok" ? 78 : 120} textAnchor="middle" fontSize={34} opacity={flash ? 1 : 0}>
            {flash === "ok" ? "🏀" : "✋"}
          </text>
        </svg>
      </button>
      <Hint>{msg}</Hint>
      <Btn onClick={shoot} disabled={Boolean(flash)}>
        Tira!
      </Btn>
    </div>
  );
}

/* ---------- 2. Le Sirene: si tocca solo il pallone vero ---------- */
type Pop = { id: number; cell: number; real: boolean; born: number };
function Sirene({ onDone }: { onDone: () => void }) {
  const NEED = 3;
  const [got, setGot] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [msg, setMsg] = useState("Le Sirene ti chiamano con i loro palloni stregati. Tocca solo il pallone vero 🏀!");
  const id = useRef(0);
  const life = 1100 - got * 150;
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      setPops((ps) => {
        const alive = ps.filter((p) => now - p.born < life);
        const free = Array.from({ length: 9 }, (_, i) => i).filter((c) => !alive.some((p) => p.cell === c));
        const cell = free[Math.floor(Math.random() * free.length)];
        return cell === undefined ? alive : [...alive, { id: id.current++, cell, real: Math.random() < 0.34, born: now }];
      });
    }, 420);
    return () => window.clearInterval(t);
  }, [life]);
  const tap = (p: Pop) => {
    setPops((ps) => ps.filter((x) => x.id !== p.id));
    if (p.real) {
      const n = got + 1;
      setMsg(n >= NEED ? "Hai resistito al canto delle Sirene!" : "Preso! Non ascoltarle…");
      if (n >= NEED) window.setTimeout(onDone, 700);
      setGot(n);
    } else {
      setMsg("Il canto delle Sirene! Ti sei distratto: si ricomincia.");
      setGot(0);
    }
  };
  return (
    <div>
      <Title title="Lo scoglio delle Sirene" n={got} of={NEED} />
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-gradient-to-b from-[#0b2a3a] to-[#0d5a6c] p-2">
        {Array.from({ length: 9 }, (_, c) => {
          const p = pops.find((x) => x.cell === c);
          return (
            <button key={c} type="button" disabled={!p || got >= NEED} onClick={() => p && tap(p)} className="grid aspect-square place-items-center rounded-xl bg-white/5 text-4xl" aria-label={p ? (p.real ? "Pallone" : "Sirena") : "Mare"}>
              {p ? <span className="motion-safe:animate-[sg-pop_0.25s_ease-out]">{p.real ? "🏀" : "🧜‍♀️"}</span> : <span className="text-base opacity-30">〰️</span>}
            </button>
          );
        })}
      </div>
      <Hint>{msg}</Hint>
    </div>
  );
}

/* ---------- 3. Scilla e Cariddi: si passa nella corsia libera ---------- */
type Wave = { id: number; blocked: number[]; y: number; hit: boolean };
function Scilla({ onDone }: { onDone: () => void }) {
  const NEED = 8;
  const [lane, setLane] = useState(1);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [passed, setPassed] = useState(0);
  const [msg, setMsg] = useState("Scilla 🐙 e Cariddi 🌀 chiudono lo stretto. Spostati nella corsia libera!");
  const laneRef = useRef(1);
  const passedRef = useRef(0);
  const finished = useRef(false);
  const move = useCallback((d: number) => {
    laneRef.current = Math.max(0, Math.min(2, laneRef.current + d));
    setLane(laneRef.current);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let spawn = 0;
    let nid = 0;
    let list: Wave[] = [];
    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const speed = 0.00055 + passedRef.current * 0.00004; // frazione dell'altezza al ms
      spawn -= dt;
      if (spawn <= 0 && !finished.current) {
        spawn = 1150 - passedRef.current * 40;
        const free = Math.floor(Math.random() * 3);
        const blocked = [0, 1, 2].filter((l) => l !== free && (Math.random() < 0.75 || passedRef.current > 3));
        list.push({ id: nid++, blocked: blocked.length ? blocked : [(free + 1) % 3], y: -0.1, hit: false });
      }
      list = list.map((w) => ({ ...w, y: w.y + speed * dt }));
      for (const w of list) {
        if (!w.hit && w.y >= 0.8 && w.y < 0.92) {
          w.hit = true;
          if (w.blocked.includes(laneRef.current)) {
            passedRef.current = 0;
            setPassed(0);
            setMsg("Travolto! Lo stretto ti ha preso: si ricomincia.");
          } else {
            passedRef.current += 1;
            setPassed(passedRef.current);
            if (passedRef.current >= NEED) {
              finished.current = true;
              setMsg("Fuori dallo stretto! Si vede l'Italia…");
              window.setTimeout(onDone, 800);
            }
          }
        }
      }
      list = list.filter((w) => w.y < 1.1);
      setWaves(list);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);
  // scorrimento col dito
  const touchX = useRef<number | null>(null);
  return (
    <div>
      <Title title="Scilla e Cariddi" n={Math.min(passed, NEED)} of={NEED} />
      <div
        className="relative mt-3 h-72 touch-none overflow-hidden rounded-2xl bg-gradient-to-b from-[#0b2a3a] to-[#0d5a6c]"
        onPointerDown={(e) => (touchX.current = e.clientX)}
        onPointerUp={(e) => {
          if (touchX.current === null) return;
          const d = e.clientX - touchX.current;
          if (Math.abs(d) > 24) move(d > 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {[1, 2].map((l) => (
          <span key={l} className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${(l / 3) * 100}%` }} />
        ))}
        {waves.map((w) =>
          w.blocked.map((l) => (
            <span key={`${w.id}-${l}`} className="absolute grid w-1/3 place-items-center text-4xl" style={{ left: `${(l / 3) * 100}%`, top: `${w.y * 100}%` }}>
              {l === 0 ? "🐙" : l === 2 ? "🌀" : (w.id % 2 ? "🐙" : "🌀")}
            </span>
          )),
        )}
        <span className="absolute grid w-1/3 place-items-center text-4xl transition-[left] duration-150" style={{ left: `${(lane / 3) * 100}%`, top: "84%" }}>
          ⛵
        </span>
      </div>
      <Hint>{msg}</Hint>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => move(-1)} className="rounded-2xl border border-border py-3 text-xl font-bold" aria-label="A sinistra">
          ←
        </button>
        <button type="button" onClick={() => move(1)} className="rounded-2xl border border-border py-3 text-xl font-bold" aria-label="A destra">
          →
        </button>
      </div>
    </div>
  );
}

/* ---------- 4. Bologna: il tiro della vittoria ---------- */
const ZONE = 0.13;
function Finale({ name, onDone }: { name: string; onDone: () => void }) {
  const [cursor, setCursor] = useState(0);
  const [zone, setZone] = useState(() => 0.3 + Math.random() * 0.4);
  const [state, setState] = useState<"aim" | "made" | "miss">("aim");
  const cur = useRef(0);
  useEffect(() => {
    if (state !== "aim") return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const v = (1 - Math.cos(((now - t0) / 1100) * 2 * Math.PI)) / 2;
      cur.current = v;
      setCursor(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);
  const shoot = () => {
    if (state === "miss") {
      setZone(0.3 + Math.random() * 0.4);
      return setState("aim");
    }
    if (state !== "aim") return;
    if (Math.abs(cur.current - zone) <= ZONE / 2) {
      setState("made");
      window.setTimeout(onDone, 1100);
    } else setState("miss");
  };
  return (
    <div>
      <Title title="Bologna: il tiro della vittoria" n={state === "made" ? 1 : 0} of={1} />
      <button type="button" onClick={shoot} className="mt-3 block w-full" aria-label="Tira">
        <svg viewBox="0 0 300 220" className="w-full rounded-2xl bg-gradient-to-b from-[#1a0f2e] via-[#5a2a3a] to-[#d9734a]">
          {/* le Due Torri */}
          <rect x={40} y={60} width={22} height={160} fill="#2a1a14" />
          <rect x={70} y={110} width={20} height={110} fill="#2a1a14" transform="rotate(4 80 220)" />
          <rect x={30} y={190} width={270} height={30} fill="#2a1a14" />
          {/* canestro */}
          <rect x={170} y={40} width={90} height={58} rx={3} fill="#f6efe9" opacity={0.92} />
          <ellipse cx={215} cy={102} rx={24} ry={5} fill="none" stroke="#e5482b" strokeWidth={4} />
          <path d="M193 102 L199 132 L231 132 L237 102" fill="none" stroke="#f6efe9" strokeWidth={1.5} />
          <text x={state === "made" ? 215 : 120} y={state === "made" ? 124 : 180} textAnchor="middle" fontSize={state === "made" ? 26 : 30}>
            🏀
          </text>
        </svg>
      </button>
      <Hint>
        {state === "made"
          ? `CIUFF! ${name} è tornato a casa!`
          : state === "miss"
            ? "Ferro! Il pubblico trattiene il fiato… riprova."
            : "Palazzetto pieno, ultimo tiro. Ferma il cursore nella zona verde."}
      </Hint>
      <div className="relative mt-1 h-4 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <span className="absolute inset-y-0 rounded-full bg-win/80" style={{ left: `${(zone - ZONE / 2) * 100}%`, width: `${ZONE * 100}%` }} />
        {state === "aim" && <span className="absolute inset-y-[-2px] w-1.5 -translate-x-1/2 rounded-full bg-white shadow" style={{ left: `${cursor * 100}%` }} />}
      </div>
      <Btn onClick={shoot} disabled={state === "made"}>
        {state === "miss" ? "Riprova" : "Tira!"}
      </Btn>
    </div>
  );
}

/* ---------- vittoria: personaggio sbloccato ---------- */
function Win({ name, photo, onClose }: { name: string; photo: string | null; onClose: () => void }) {
  return (
    <div className="relative mt-4 overflow-hidden text-center">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-0 text-xl motion-safe:animate-[sg-confetti_1.8s_ease-in_forwards]"
          style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.12}s` }}
        >
          {["🎉", "✨", "🏀", "💚"][i % 4]}
        </span>
      ))}
      <p className="eyebrow text-primary">Personaggio sbloccato!</p>
      <p className="display mt-1 text-4xl leading-none">{name} è a casa</p>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- caricatura su Supabase Storage
        <img src={photo} alt={name} className="mx-auto mt-4 aspect-[4/5] w-48 rounded-2xl object-cover ring-2 ring-primary/70 motion-safe:animate-[sg-unlock_0.9s_ease-out]" />
      )}
      <p className="mt-3 text-sm text-muted">Almeno nel tuo telefono. Quello vero: ✈️ torno a marzo.</p>
      <Btn onClick={onClose}>Vedi la figurina</Btn>
    </div>
  );
}
