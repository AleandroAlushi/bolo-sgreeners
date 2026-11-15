"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { StaffCard } from "./player";
import { PhotoViewer } from "./photo-viewer";

/**
 * Easter egg della pagina Staff: due tiri liberi davanti al coach. Basta sbagliarne uno e si
 * sbloccano le versioni "evil" del coach e del vice, che restano visibili (su quel telefono)
 * sotto lo staff. Il gioco si apre da solo alla prima visita, poi dal pallone in fondo alla pagina.
 */

export interface EvilCard {
  firstName: string;
  lastName: string;
  role: string;
  photoPath: string;
  url: string;
}

const SEEN_KEY = "sg-tiri-liberi-visto";
const UNLOCK_KEY = "sg-staff-evil";
const UNLOCK_EVENT = "sg-staff-evil";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* navigazione privata: vale solo per questa visita */
  }
};
const subscribeUnlock = (cb: () => void) => {
  window.addEventListener(UNLOCK_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(UNLOCK_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function StaffEasterEgg({ evil }: { evil: EvilCard[] }) {
  const unlocked = useSyncExternalStore(subscribeUnlock, () => read(UNLOCK_KEY) === "1", () => false);
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // alla prima visita il gioco si apre da solo, dopo che la pagina si è vista
  useEffect(() => {
    if (read(SEEN_KEY)) return;
    const t = window.setTimeout(() => {
      write(SEEN_KEY, "1");
      setOpen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, []);

  const unlock = useCallback(() => {
    write(UNLOCK_KEY, "1");
    window.dispatchEvent(new Event(UNLOCK_EVENT));
  }, []);

  return (
    <>
      {unlocked && (
        <section ref={sectionRef} className="mt-8">
          <p className="eyebrow text-loss">Sbloccate ai tiri liberi</p>
          <h2 className="display mt-1 text-3xl">Versioni evil</h2>
          <PhotoViewer photos={evil.map((e) => ({ url: e.url, caption: `${e.firstName} ${e.lastName} · versione evil` }))}>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {evil.map((e, i) => (
                <div key={e.photoPath} className="rounded-2xl shadow-[0_0_28px_-6px_rgba(239,68,68,0.75)] ring-2 ring-loss/70">
                  <StaffCard firstName={e.firstName} lastName={e.lastName} role={e.role} photoPath={e.photoPath} photoIndex={i} extra={<span className="font-semibold text-loss">Versione evil</span>} />
                </div>
              ))}
            </div>
          </PhotoViewer>
        </section>
      )}
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Tiri liberi davanti al coach"
          title="Tiri liberi"
          className="grid size-11 place-items-center rounded-full border border-border bg-surface text-xl opacity-60 transition hover:opacity-100"
        >
          🏀
        </button>
      </div>
      {open &&
        createPortal(
          <FreeThrows
            evil={evil}
            alreadyUnlocked={unlocked}
            onMiss={unlock}
            onClose={() => setOpen(false)}
            onShowEvil={() => {
              setOpen(false);
              window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
            }}
          />,
          document.body,
        )}
    </>
  );
}

/* ---------- il minigioco ---------- */

type Phase = "aim" | "flight" | "shot" | "end";
const ZONE = 0.15; // larghezza della zona verde (frazione della barra)
const PERIOD = 1300; // ms per un'andata e ritorno del cursore
const FLIGHT = 950; // ms del tiro

const HOOP = { x: 150, y: 96 };
const START = { x: 150, y: 318 };

function FreeThrows({
  evil,
  alreadyUnlocked,
  onMiss,
  onClose,
  onShowEvil,
}: {
  evil: EvilCard[];
  alreadyUnlocked: boolean;
  onMiss: () => void;
  onClose: () => void;
  onShowEvil: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("aim");
  const [shots, setShots] = useState<boolean[]>([]);
  const [zone, setZone] = useState(() => 0.3 + Math.random() * 0.4);
  const [cursor, setCursor] = useState(0);
  const [ball, setBall] = useState({ x: START.x, y: START.y, r: 22, front: true });
  const cursorRef = useRef(0);
  const raf = useRef(0); // cursore
  const flight = useRef(0); // tiro (ref separato: chiudere il cursore non deve fermare il tiro)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(flight.current);
    };
  }, [onClose]);

  // cursore che va avanti e indietro sulla barra
  useEffect(() => {
    if (phase !== "aim") return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const v = (1 - Math.cos(((now - t0) / PERIOD) * 2 * Math.PI)) / 2;
      cursorRef.current = v;
      setCursor(v);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const shoot = () => {
    if (phase !== "aim") return;
    cancelAnimationFrame(raf.current);
    const off = cursorRef.current - zone;
    const made = Math.abs(off) <= ZONE / 2;
    // sbagliato: il pallone prende il ferro dal lato verso cui è andato il cursore
    const side = off < 0 ? -1 : 1;
    const miss = Math.min(1, Math.abs(off) / 0.35);
    setPhase("flight");
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / FLIGHT);
      let x: number, y: number;
      if (t < 0.75) {
        // parabola fino al ferro
        const u = t / 0.75;
        const endX = HOOP.x + (made ? 0 : side * (16 + miss * 22));
        const endY = HOOP.y - (made ? 4 : 2);
        const ctrlY = 0;
        x = (1 - u) * (1 - u) * START.x + 2 * (1 - u) * u * ((START.x + endX) / 2) + u * u * endX;
        y = (1 - u) * (1 - u) * START.y + 2 * (1 - u) * u * ctrlY + u * u * endY;
      } else {
        const u = (t - 0.75) / 0.25;
        if (made) {
          x = HOOP.x;
          y = HOOP.y - 4 + u * 70; // giù dalla retina
        } else {
          x = HOOP.x + side * (16 + miss * 22) + side * u * 60; // rimbalza via dal ferro
          y = HOOP.y - 2 - Math.sin(u * Math.PI) * 30 + u * 40;
        }
      }
      setBall({ x, y, r: 22 - 10 * Math.min(1, t / 0.75), front: t < 0.75 ? true : !made });
      if (t < 1) flight.current = requestAnimationFrame(tick);
      else {
        const next = [...shots, made];
        setShots(next);
        if (!made) onMiss();
        setPhase(next.length >= 2 ? "end" : "shot");
      }
    };
    flight.current = requestAnimationFrame(tick);
  };

  const nextShot = () => {
    setZone(0.3 + Math.random() * 0.4);
    setBall({ x: START.x, y: START.y, r: 22, front: true });
    setPhase("aim");
  };
  const restart = () => {
    setShots([]);
    nextShot();
  };

  const last = shots.at(-1);
  const missed = shots.includes(false);
  const scoring = phase === "aim" || phase === "flight";

  return (
    <div role="dialog" aria-modal="true" aria-label="Tiri liberi" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-primary">Prova dello staff</p>
            <h2 className="display text-3xl leading-none">Tiri liberi</h2>
          </div>
          <div className="flex items-center gap-1.5 pt-1" aria-label={`Tiri: ${shots.length} di 2`}>
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`grid size-7 place-items-center rounded-full text-xs font-bold ${
                  shots[i] === undefined ? "border border-border text-muted" : shots[i] ? "bg-win text-black" : "bg-loss text-white"
                }`}
              >
                {shots[i] === undefined ? i + 1 : shots[i] ? "✓" : "✗"}
              </span>
            ))}
            <button type="button" aria-label="Chiudi" onClick={onClose} className="ml-1 grid size-8 place-items-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20">
              ×
            </button>
          </div>
        </div>

        {phase !== "end" ? (
          <>
            <p className="mt-2 text-sm text-muted">
              {phase === "shot"
                ? last
                  ? "Ciuff! Il coach annuisce. Ultimo tiro."
                  : "Ferro… il coach ti fissa. Ultimo tiro."
                : "Il coach ti guarda. Ferma il cursore nella zona verde e fai 2 su 2."}
            </p>
            <button type="button" onClick={phase === "shot" ? nextShot : shoot} disabled={phase === "flight"} className="mt-3 block w-full" aria-label={phase === "shot" ? "Prossimo tiro" : "Tira"}>
              <Court ball={ball} />
            </button>
            <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className="absolute inset-y-0 rounded-full bg-win/80" style={{ left: `${(zone - ZONE / 2) * 100}%`, width: `${ZONE * 100}%` }} />
              {scoring && <span className="absolute inset-y-[-2px] w-1.5 -translate-x-1/2 rounded-full bg-white shadow" style={{ left: `${cursor * 100}%` }} />}
            </div>
            <button
              type="button"
              onClick={phase === "shot" ? nextShot : shoot}
              disabled={phase === "flight"}
              className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-ink transition active:scale-[0.98] disabled:opacity-50"
            >
              {phase === "shot" ? "Prossimo tiro" : "Tira!"}
            </button>
          </>
        ) : missed ? (
          <div className="mt-4 text-center">
            <p className="text-5xl">😡</p>
            <p className="display mt-2 text-3xl leading-none text-loss">Hai fatto arrabbiare il coach!</p>
            <p className="mt-2 text-sm text-muted">
              {alreadyUnlocked && shots.filter(Boolean).length === 0 ? "Di nuovo? " : ""}Hai sbloccato le versioni evil di Cassa e Cesare.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {evil.map((e) => (
                // eslint-disable-next-line @next/next/no-img-element -- foto su Supabase Storage
                <img key={e.url} src={e.url} alt={`${e.firstName} ${e.lastName}, versione evil`} className="aspect-[4/5] w-full rounded-xl object-cover ring-2 ring-loss/70" />
              ))}
            </div>
            <button type="button" onClick={onShowEvil} className="mt-4 w-full rounded-2xl bg-loss py-3 font-bold text-white transition active:scale-[0.98]">
              Guardale
            </button>
          </div>
        ) : (
          <div className="mt-4 text-center">
            <p className="text-5xl">🏆</p>
            <p className="display mt-2 text-3xl leading-none text-win">2 su 2!</p>
            <p className="mt-2 text-sm text-muted">Il coach è fiero di te. Ma qualcosa resta nascosto a chi non sbaglia mai…</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={restart} className="rounded-2xl border border-border py-3 font-bold">
                Riprova
              </button>
              <button type="button" onClick={onClose} className="rounded-2xl bg-primary py-3 font-bold text-primary-ink">
                Chiudi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Canestro visto dalla lunetta: il pallone passa dietro al ferro quando entra. */
function Court({ ball }: { ball: { x: number; y: number; r: number; front: boolean } }) {
  const Ball = (
    <g transform={`translate(${ball.x} ${ball.y})`}>
      <circle r={ball.r} fill="#f2a20c" stroke="#3b1d00" strokeWidth={2} />
      <path d={`M${-ball.r} 0 H${ball.r} M0 ${-ball.r} V${ball.r}`} stroke="#3b1d00" strokeWidth={1.6} />
      <path d={`M${-ball.r * 0.7} ${-ball.r * 0.7} Q0 0 ${-ball.r * 0.7} ${ball.r * 0.7} M${ball.r * 0.7} ${-ball.r * 0.7} Q0 0 ${ball.r * 0.7} ${ball.r * 0.7}`} fill="none" stroke="#3b1d00" strokeWidth={1.4} />
    </g>
  );
  return (
    <svg viewBox="0 0 300 340" className="w-full rounded-2xl bg-gradient-to-b from-[#0c2414] via-[#0f3a1f] to-[#19d35e]/60">
      {/* parquet */}
      <path d="M0 250 L300 250 L300 340 L0 340 Z" fill="#b97a3f" opacity={0.85} />
      <path d="M70 340 L110 250 L190 250 L230 340" fill="none" stroke="#f6efe9" strokeWidth={2} opacity={0.7} />
      <ellipse cx={150} cy={250} rx={40} ry={8} fill="none" stroke="#f6efe9" strokeWidth={2} opacity={0.7} />
      {/* tabellone */}
      <rect x={95} y={30} width={110} height={70} rx={4} fill="#f6efe9" opacity={0.92} />
      <rect x={130} y={62} width={40} height={30} fill="none" stroke="#f2a20c" strokeWidth={3} />
      <rect x={146} y={100} width={8} height={150} fill="#2b2b2b" />
      {!ball.front && Ball}
      {/* retina e ferro */}
      <path d={`M${HOOP.x - 26} ${HOOP.y} L${HOOP.x - 18} ${HOOP.y + 34} L${HOOP.x + 18} ${HOOP.y + 34} L${HOOP.x + 26} ${HOOP.y}`} fill="none" stroke="#f6efe9" strokeWidth={1.5} opacity={0.9} />
      <path d={`M${HOOP.x - 13} ${HOOP.y} L${HOOP.x - 6} ${HOOP.y + 34} M${HOOP.x + 13} ${HOOP.y} L${HOOP.x + 6} ${HOOP.y + 34} M${HOOP.x - 22} ${HOOP.y + 16} L${HOOP.x + 22} ${HOOP.y + 16}`} stroke="#f6efe9" strokeWidth={1} opacity={0.7} />
      <ellipse cx={HOOP.x} cy={HOOP.y} rx={27} ry={6} fill="none" stroke="#e5482b" strokeWidth={4} />
      {ball.front && Ball}
    </svg>
  );
}
