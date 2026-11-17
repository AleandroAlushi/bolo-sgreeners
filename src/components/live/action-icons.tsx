/**
 * Iconcine dei pulsanti della diretta (disegnate apposta, a tratto come le altre icone del sito).
 * Mani stilizzate: parentesi con le dita per chi afferra, palmo aperto per la stoppata, pugno
 * alzato per il fallo (il gesto dell'arbitro).
 */
import type { ReactNode } from "react";

function Svg({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

/** Pallone con gli spicchi. */
const Ball = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <>
    <circle cx={cx} cy={cy} r={r} />
    <path
      d={`M${cx - r} ${cy}h${2 * r}M${cx - r * 0.55} ${cy - r * 0.83}q${r * 0.75} ${r * 0.83} 0 ${r * 1.66}M${cx + r * 0.55} ${cy - r * 0.83}q${-r * 0.75} ${r * 0.83} 0 ${r * 1.66}`}
      strokeWidth={1.1}
    />
  </>
);

/** Due mani che afferrano il pallone dai lati. */
const Grab = ({ cy }: { cy: number }) => (
  <>
    <Ball cx={12} cy={cy} r={4.2} />
    <path d={`M6.6 ${cy - 4.5}q-2.6 4.5 0 9M17.4 ${cy - 4.5}q2.6 4.5 0 9`} strokeWidth={2.2} />
    <path d={`M6 ${cy - 2}h1.6M6 ${cy + 1}h1.6M18 ${cy - 2}h-1.6M18 ${cy + 1}h-1.6`} strokeWidth={1.3} />
  </>
);

/** Rimbalzo difensivo: presa in alto e freccia verso la propria metà (si scende). */
export const IconDreb = () => (
  <Svg>
    <Grab cy={8.5} />
    <path d="M12 16v6M9.5 19.5 12 22l2.5-2.5" />
  </Svg>
);

/** Rimbalzo offensivo: presa e freccia verso il canestro (si risale). */
export const IconOreb = () => (
  <Svg>
    <path d="M12 8V2M9.5 4.5 12 2l2.5 2.5" />
    <Grab cy={15.5} />
  </Svg>
);

/** Assist: passaggio con traiettoria tratteggiata verso un compagno. */
export const IconAssist = () => (
  <Svg>
    <Ball cx={6} cy={17} r={3.6} />
    <path d="M9.5 13.5Q13 6 19 6" strokeDasharray="2 2.2" />
    <path d="M16.2 3.8 19 6l-2.6 2.4" />
    <circle cx={19.5} cy={12.5} r={2} />
    <path d="M16 20.5a3.5 3.5 0 0 1 7 0" />
  </Svg>
);

/** Stoppata: mano aperta che schiaffeggia il pallone. */
export const IconBlock = () => (
  <Svg>
    <path d="M12.5 12.5V5a1.2 1.2 0 0 1 2.4 0v5M14.9 9.5V3.8a1.2 1.2 0 0 1 2.4 0v6M17.3 9.8V5a1.2 1.2 0 0 1 2.4 0v7.2a5.5 5.5 0 0 1-5.5 5.5h-.6a4.5 4.5 0 0 1-3.6-1.8l-2-2.7a1.3 1.3 0 0 1 2-1.6l1.6 1.6" />
    <Ball cx={6} cy={18.5} r={3.3} />
    <path d="M3 13.2l1.4 1.2M6.8 12l.1 1.8M1.6 16.4l1.7.3" strokeWidth={1.4} />
  </Svg>
);

/** Recupero: mano che strappa il pallone, con le linee di velocità. */
export const IconSteal = () => (
  <Svg>
    <Ball cx={15} cy={12} r={4.4} />
    <path d="M10.6 7.2q-2.8 4.8 0 9.6" strokeWidth={2.2} />
    <path d="M10 9.5h1.6M10 12h1.6M10 14.5h1.6" strokeWidth={1.3} />
    <path d="M2 9h4.5M1 12h5M2 15h4.5" strokeWidth={1.5} />
  </Svg>
);

/** Palla persa: il pallone scappa via dalle mani, con il punto esclamativo. */
export const IconTurnover = () => (
  <Svg>
    <path d="M3 18q2.5-6 8-8" strokeDasharray="2 2.2" />
    <Ball cx={15.5} cy={8.5} r={4} />
    <path d="M20.5 15v3.5M20.5 21.3v.2" strokeWidth={2.2} />
    <path d="M2.5 21.5h6" strokeWidth={1.4} />
  </Svg>
);

/** Fallo: pugno chiuso alzato, il segnale dell'arbitro. */
export const IconFoul = () => (
  <Svg>
    <path d="M8 9.5V6.2a1.3 1.3 0 0 1 2.6 0V5.4a1.3 1.3 0 0 1 2.6 0v.4a1.3 1.3 0 0 1 2.6 0v.8a1.3 1.3 0 0 1 2.4.6V10a4 4 0 0 1-4 4h-2.2a4 4 0 0 1-4-4z" />
    <path d="M8 9.2q-2 .2-2 2.1 0 1.9 2.4 1.9" />
    <path d="M10.2 14v8M15 14v8" />
    <path d="M3 4l1.6 1M3.2 8.2H5M21 4l-1.6 1" strokeWidth={1.4} />
  </Svg>
);

/** Cambio: le due frecce che si scambiano. */
export const IconSub = () => (
  <Svg>
    <path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5" />
    <path d="M20 16H6M9.5 12.5 6 16l3.5 3.5" />
  </Svg>
);

/** Mattone (loud ass brick). */
export const IconBrick = () => (
  <Svg>
    <rect x="2.5" y="7" width="19" height="10" rx="1.2" />
    <path d="M2.5 12h19M9 7v5M15 12v5" strokeWidth={1.3} />
  </Svg>
);
