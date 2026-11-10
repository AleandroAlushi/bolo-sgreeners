/**
 * Pezzi degli sfondi delle grafiche nuove, disegnati in codice (Satori: solo flexbox, gradienti,
 * bordi e trasformazioni; niente blur). Le sfumature "morbide" si fanno con colonne affiancate a
 * opacità decrescente.
 */
import type { CSSProperties, ReactNode } from "react";

export const INK = "#f6efe9";
export const DARK = "#0c0a09";

/** Generatore pseudo-casuale fisso: le righe del parquet sono sempre uguali. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Box({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return <div style={{ display: "flex", position: "absolute", ...style }}>{children}</div>;
}

/** Grana a pellicola sopra tutto. */
export function Grain({ src, width, height, opacity = 0.5 }: { src: string; width: number; height: number; opacity?: number }) {
  return <Box style={{ top: 0, left: 0, width, height, backgroundImage: `url(${src})`, backgroundRepeat: "repeat", backgroundSize: "256px 256px", opacity }} />;
}

/** Parquet scuro e graffiato (fondo del pannello sinistro). */
export function CourtTexture({ left = 0, top = 0, width, height, seed = 7 }: { left?: number; top?: number; width: number; height: number; seed?: number }) {
  const r = rng(seed);
  const lines = Array.from({ length: Math.round(height / 38) }, () => ({
    y: r() * height,
    x: r() * width * 0.7,
    w: width * (0.2 + r() * 0.8),
    h: 1 + Math.round(r() * 2),
    o: 0.12 + r() * 0.3,
    warm: r() > 0.35,
  }));
  const posts = Array.from({ length: 5 }, () => ({ x: r() * width, w: 2 + r() * 4, o: 0.05 + r() * 0.08 }));
  return (
    <Box style={{ left, top, width, height, overflow: "hidden", backgroundColor: "#140e0b" }}>
      <Box
        style={{
          top: 0,
          left: 0,
          width,
          height,
          backgroundImage: "radial-gradient(ellipse at 30% 20%, rgba(92,48,28,0.55) 0%, rgba(20,14,11,0) 60%), radial-gradient(ellipse at 70% 85%, rgba(70,38,24,0.5) 0%, rgba(20,14,11,0) 55%)",
        }}
      />
      {posts.map((p, i) => (
        <Box key={`p${i}`} style={{ top: 0, left: p.x, width: p.w, height, backgroundColor: `rgba(170,120,90,${p.o})` }} />
      ))}
      {lines.map((l, i) => (
        <Box
          key={i}
          style={{
            top: l.y,
            left: l.x,
            width: l.w,
            height: l.h,
            backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${l.warm ? `rgba(196,92,48,${l.o})` : `rgba(150,130,120,${l.o * 0.7})`} 30%, ${l.warm ? `rgba(196,92,48,${l.o})` : `rgba(150,130,120,${l.o * 0.7})`} 70%, rgba(0,0,0,0) 100%)`,
          }}
        />
      ))}
    </Box>
  );
}

/** Arco sottile bianco (righe del campo). */
export function Arc({ cx, cy, r, opacity = 0.8, width = 2 }: { cx: number; cy: number; r: number; opacity?: number; width?: number }) {
  return <Box style={{ left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, border: `${width}px solid rgba(255,255,255,${opacity})` }} />;
}

/** Pallone da basket disegnato (spicchi compresi). */
export function Ball({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const seam = "rgba(30,14,8,0.9)";
  const sw = Math.max(3, Math.round(r * 0.035));
  return (
    <Box
      style={{
        left: cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        overflow: "hidden",
        backgroundImage: "radial-gradient(circle at 38% 32%, #f08a48 0%, #d0612a 38%, #9c3f17 72%, #4a1a08 100%)",
      }}
    >
      <Box style={{ left: r - sw / 2, top: 0, width: sw, height: r * 2, backgroundColor: seam }} />
      <Box style={{ left: 0, top: r - sw / 2, width: r * 2, height: sw, backgroundColor: seam }} />
      <Box style={{ left: -r * 1.25, top: -r * 0.2, width: r * 1.9, height: r * 2.4, borderRadius: r * 1.2, border: `${sw}px solid ${seam}` }} />
      <Box style={{ left: r * 1.35, top: -r * 0.2, width: r * 1.9, height: r * 2.4, borderRadius: r * 1.2, border: `${sw}px solid ${seam}` }} />
    </Box>
  );
}

/** Profilo a campana per i bordi morbidi (24 fette). */
const FALLOFF = Array.from({ length: 24 }, (_, i) => {
  const x = (i + 0.5) / 24 - 0.5;
  return Math.round(Math.exp(-(x * x) / 0.045) * 1000) / 1000;
});

/** Barra di luce verticale dai bordi morbidi: `stops` è il gradiente dall'alto in basso. */
export function VBar({ left, top = 0, width, height, stops, opacity = 1 }: { left: number; top?: number; width: number; height: number; stops: string; opacity?: number }) {
  return (
    <Box style={{ left, top, width, height, opacity }}>
      {FALLOFF.map((o, i) => (
        <div key={i} style={{ display: "flex", flex: 1, opacity: o, backgroundImage: `linear-gradient(180deg, ${stops})` }} />
      ))}
    </Box>
  );
}

/** Fascia di luce orizzontale dai bordi morbidi: `stops` è il gradiente da sinistra a destra. */
export function HBar({ left, top, width, height, stops, opacity = 1 }: { left: number; top: number; width: number; height: number; stops: string; opacity?: number }) {
  return (
    <Box style={{ left, top, width, height, flexDirection: "column", opacity }}>
      {FALLOFF.map((o, i) => (
        <div key={i} style={{ display: "flex", flex: 1, opacity: o, backgroundImage: `linear-gradient(90deg, ${stops})` }} />
      ))}
    </Box>
  );
}

/** Bagliore grigio diffuso (fondi neri del box score e dei leader). */
export function Haze({ cx, cy, rx, ry, opacity = 0.22 }: { cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return (
    <Box
      style={{
        left: cx - rx,
        top: cy - ry,
        width: rx * 2,
        height: ry * 2,
        backgroundImage: `radial-gradient(ellipse at center, rgba(200,200,200,${opacity}) 0%, rgba(160,160,160,${opacity * 0.45}) 40%, rgba(0,0,0,0) 70%)`,
      }}
    />
  );
}

/**
 * Titolo condensato e altissimo ("BSG", "FINALE"): Bebas Neue stretto in orizzontale.
 * `cap` è l'altezza delle maiuscole in pixel, `left`/`top` l'angolo in alto a sinistra delle lettere.
 */
export const BEBAS_CAP = 0.7;
export function Condensed({ text, cap, left, top, squeeze = 0.68, color = INK }: { text: string; cap: number; left: number; top: number; squeeze?: number; color?: string }) {
  const size = cap / BEBAS_CAP;
  // Bebas: la riga è alta 1.2em e le maiuscole partono a ~0.2em dall'alto
  const lineTop = top - size * 0.197;
  return (
    <Box
      style={{
        left,
        top: lineTop,
        fontFamily: "Bebas",
        fontSize: size,
        lineHeight: 1.2,
        color,
        whiteSpace: "nowrap",
        transform: `scaleX(${squeeze})`,
        transformOrigin: "left top",
      }}
    >
      {text}
    </Box>
  );
}
