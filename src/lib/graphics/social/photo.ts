/**
 * Foto per le grafiche: ritaglio alla misura giusta (sharp, punto d'interesse automatico) e,
 * per la colonna della presentazione, la tinta arancio → verde → azzurro già applicata
 * (Satori non ha i metodi di fusione dei livelli).
 */
import sharp from "sharp";

const svgGradient = (w: number, h: number, stops: [number, string, number][]) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops
      .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
      .join("")}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
  );

export const COLUMN_STOPS: [number, string, number][] = [
  [0, "#c06a2c", 1],
  [0.25, "#8a7a2a", 1],
  [0.45, "#55b83c", 1],
  [0.62, "#36dc5c", 1],
  [0.82, "#1fc9a6", 1],
  [1, "#2a8fdc", 1],
];

async function load(src: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(src)) return src;
  if (src.startsWith("data:")) return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  const res = await fetch(src, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Foto non raggiungibile (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

const toUri = (b: Buffer, type = "image/jpeg") => `data:${type};base64,${b.toString("base64")}`;

/** Foto ritagliata a w×h e tinta con il gradiente della colonna (stile presentazione). */
export async function tintedPhoto(src: string | Buffer, w: number, h: number): Promise<string> {
  const base = await sharp(await load(src)).rotate().resize(w, h, { fit: "cover", position: sharp.strategy.attention }).modulate({ saturation: 0.75 }).toBuffer();
  const out = await sharp(base)
    .composite([
      { input: svgGradient(w, h, COLUMN_STOPS), blend: "overlay" },
      { input: svgGradient(w, h, COLUMN_STOPS.map(([o, c]) => [o, c, 0.26] as [number, string, number])), blend: "over" },
    ])
    .jpeg({ quality: 86 })
    .toBuffer();
  return toUri(out);
}

/** Foto ritagliata a w×h senza ritocchi di colore (MVP, leader). */
export async function croppedPhoto(src: string | Buffer, w: number, h: number, position: "attention" | "top" = "attention"): Promise<string> {
  const out = await sharp(await load(src))
    .rotate()
    .resize(w, h, { fit: "cover", position: position === "top" ? "top" : sharp.strategy.attention })
    .jpeg({ quality: 88 })
    .toBuffer();
  return toUri(out);
}
