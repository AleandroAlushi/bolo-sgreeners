/**
 * Testo posizionato al pixel nelle grafiche in stile Canva: Satori non misura il testo, quindi
 * larghezze e linea di base si calcolano dalle misure dei font (./metrics.ts).
 * Con lineHeight 1, Satori mette la linea di base a top + (size − (asc + desc)·size) / 2 + asc·size.
 */
import type { CSSProperties } from "react";
import { METRICS, type FontKey } from "./metrics";

export const INK = "#f6f2ec";

const FAMILY: Record<FontKey, { fontFamily: string; fontWeight: number; fontStyle: "normal" | "italic" }> = {
  Bebas: { fontFamily: "Bebas", fontWeight: 400, fontStyle: "normal" },
  Barlow: { fontFamily: "Barlow", fontWeight: 400, fontStyle: "normal" },
  BarlowSemi: { fontFamily: "Barlow", fontWeight: 600, fontStyle: "normal" },
  Playfair: { fontFamily: "Playfair", fontWeight: 500, fontStyle: "italic" },
};

const glyph = (font: FontKey, ch: string) => METRICS[font].g[ch] ?? METRICS[font].g["n"];

/** Larghezza (avanzamento) del testo in pixel. */
export function measure(text: string, font: FontKey, size: number) {
  let w = 0;
  for (const ch of text) w += glyph(font, ch)[0];
  return w * size;
}

/** Inchiostro del testo: da dove parte la prima lettera e quanto è largo, in pixel. */
function ink(text: string, font: FontKey, size: number) {
  const chars = [...text];
  if (!chars.length) return { left: 0, width: 0 };
  const first = glyph(font, chars[0]);
  const last = glyph(font, chars[chars.length - 1]);
  const adv = chars.slice(0, -1).reduce((s, ch) => s + glyph(font, ch)[0], 0);
  return { left: first[1] * size, width: (adv + last[2] - first[1]) * size };
}

/** Larghezza dell'inchiostro del testo in pixel (senza i margini delle lettere). */
export const inkWidth = (text: string, font: FontKey, size: number) => ink(text, font, size).width;

/** Corpo massimo (≤ size) perché il testo stia in `max` pixel. */
export function fitSize(text: string, font: FontKey, size: number, max: number, min = 20) {
  const w = measure(text, font, size);
  return w <= max ? size : Math.max(min, Math.floor((size * max) / w));
}

const topFromBaseline = (font: FontKey, size: number, baseline: number) => {
  const m = METRICS[font];
  return baseline - (size - (m.asc + m.desc) * size) / 2 - m.asc * size;
};

/**
 * Testo con la linea di base a `y`. `align`: "l" (x = inizio), "c" (x = centro), "r" (x = fine).
 */
export function T({ children, x, y, size, font = "Barlow", align = "l", color = INK, style }: { children: string; x: number; y: number; size: number; font?: FontKey; align?: "l" | "c" | "r"; color?: string; style?: CSSProperties }) {
  const w = measure(children, font, size);
  const left = align === "l" ? x : align === "c" ? x - w / 2 : x - w;
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left,
        top: topFromBaseline(font, size, y),
        width: Math.ceil(w) + 4,
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color,
        ...FAMILY[font],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Titolo Bebas stirato esattamente nel riquadro delle maiuscole [x0, y0, x1, y1]
 * (come "BSG", "FINALE", "BOX SCORE" nelle grafiche Canva).
 */
export function Stretch({ text, box, color = INK }: { text: string; box: [number, number, number, number]; color?: string }) {
  const [x0, y0, x1, y1] = box;
  const m = METRICS.Bebas;
  const size = (y1 - y0) / m.cap;
  const k = ink(text, "Bebas", size);
  const sx = (x1 - x0) / Math.max(k.width, 1);
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: x0 - k.left * sx,
        top: topFromBaseline("Bebas", size, y1),
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color,
        transform: `scaleX(${sx})`,
        transformOrigin: "left top",
        ...FAMILY.Bebas,
      }}
    >
      {text}
    </div>
  );
}

/** Bebas alto `cap` px e stretto di `squeeze`, centrato (o allineato) su x; y = cima delle maiuscole. */
export function Squeezed({ text, x, y, cap, squeeze, align = "c" }: { text: string; x: number; y: number; cap: number; squeeze: number; align?: "l" | "c" | "r" }) {
  const size = cap / METRICS.Bebas.cap;
  const w = ink(text, "Bebas", size).width * squeeze;
  const x0 = align === "l" ? x : align === "c" ? x - w / 2 : x - w;
  return <Stretch text={text} box={[Math.round(x0), y, Math.round(x0 + w), y + cap]} />;
}

/** Immagine posizionata in assoluto. */
export function Pic({ src, x, y, w, h, style }: { src: string; x: number; y: number; w: number; h: number; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse
  return <img src={src} alt="" width={w} height={h} style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }} />;
}
