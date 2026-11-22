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
  const input = await load(src);
  if ((await sharp(input).metadata()).hasAlpha) return tintedCutout(input, w, h);
  const base = await sharp(input).rotate().resize(w, h, { fit: "cover", position: sharp.strategy.attention }).modulate({ saturation: 0.75 }).toBuffer();
  const out = await sharp(base)
    .composite([
      { input: svgGradient(w, h, COLUMN_STOPS), blend: "overlay" },
      { input: svgGradient(w, h, COLUMN_STOPS.map(([o, c]) => [o, c, 0.26] as [number, string, number])), blend: "over" },
    ])
    .jpeg({ quality: 86 })
    .toBuffer();
  return toUri(out);
}

/**
 * Scontorno (PNG trasparente) per la colonna della presentazione: la figura intera, appoggiata in
 * basso e senza tagli, con una tinta più leggera della foto piena; lo sfondo resta trasparente così
 * si vede il gradiente della colonna.
 */
async function tintedCutout(input: Buffer, w: number, h: number): Promise<string> {
  const fitted = await sharp(input)
    .rotate()
    .trim()
    .resize(Math.round(w * 0.96), Math.round(h * 0.86), { fit: "inside" })
    .toBuffer();
  const placed = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: "south" }])
    .png()
    .toBuffer();
  const alpha = await sharp(placed).extractChannel(3).raw().toBuffer();
  const tinted = await sharp(placed)
    .removeAlpha()
    .modulate({ saturation: 0.85 })
    .composite([{ input: svgGradient(w, h, COLUMN_STOPS.map(([o, c]) => [o, c, 0.16] as [number, string, number])), blend: "over" }])
    .raw()
    .toBuffer();
  const out = await sharp(tinted, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  return toUri(out, "image/png");
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

/**
 * Foto per MVP e leader: se è uno scontorno (PNG con trasparenza) la si adatta a w×h senza
 * tagliarla, appoggiata in basso; altrimenti la si ritaglia a riempire il riquadro.
 * `bust`: dello scontorno solo il mezzobusto (testa e spalle), come nei leader.
 */
export async function playerPhoto(src: string | Buffer, w: number, h: number, bust = false): Promise<{ src: string; cutout: boolean }> {
  const input = await load(src);
  const meta = await sharp(input).metadata();
  if (meta.hasAlpha) {
    const { data, info } = await sharp(input).rotate().trim().toBuffer({ resolveWithObject: true });
    const top = bust ? sharp(data).extract({ left: 0, top: 0, width: info.width, height: Math.min(info.height, Math.round(info.width * 0.95)) }) : sharp(data);
    const out = await sharp(await top.toBuffer())
      .resize(w, h, { fit: "contain", position: "bottom", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return { src: toUri(out, "image/png"), cutout: true };
  }
  return { src: await croppedPhoto(input, w, h), cutout: false };
}
