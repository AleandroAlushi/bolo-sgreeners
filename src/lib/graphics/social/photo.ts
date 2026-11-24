/**
 * Foto per le grafiche in stile Canva, preparate con sharp perché Satori non ha i metodi di fusione
 * dei livelli: giocatori colorati con la sfumatura della base (presentazione), scontorni sfumati in
 * basso (MVP) e mezzo busto ridotti alla scala comune (leader).
 */
import sharp from "sharp";

async function load(src: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(src)) return src;
  if (src.startsWith("data:")) return Buffer.from(src.slice(src.indexOf(",") + 1), "base64");
  const res = await fetch(src, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Foto non raggiungibile (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

const toUri = (b: Buffer, type = "image/jpeg") => `data:${type};base64,${b.toString("base64")}`;

// ---------------------------------------------------------------------------
// Grafiche in stile Canva (dalla stagione 2026-27, seconda serie)
// ---------------------------------------------------------------------------
export interface PlacedImage {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Scontorno (PNG trasparente) tagliato attorno alla figura; null se la foto non ha trasparenza. */
async function trimmedCutout(src: string | Buffer): Promise<Buffer | null> {
  const input = await load(src);
  if (!(await sharp(input).metadata()).hasAlpha) return null;
  return sharp(input).rotate().trim({ threshold: 10 }).png().toBuffer();
}

/** Numeri casuali ripetibili (grana uguale a ogni rigenerazione). */
function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

/**
 * Giocatore scontornato colorato con la sfumatura che ha sotto, come nelle presentazioni Canva:
 * la luminosità è quella della foto, il colore quello della base (fusione "luce soffusa"), con la
 * stessa grana. `size`: altezza (o larghezza con `byWidth`) in pixel; `fadeFrom`: da quale y della
 * grafica il giocatore sfuma in basso.
 */
export async function tintedOnBase(
  src: string | Buffer,
  base: Buffer,
  at: { x: number; y: number; size: number; byWidth?: boolean },
  strength: number,
  fadeFrom?: number,
): Promise<PlacedImage | null> {
  const cut = await trimmedCutout(src);
  if (!cut) return null;
  const meta = await sharp(cut).metadata();
  const k = at.size / (at.byWidth ? meta.width! : meta.height!);
  const w = Math.round(meta.width! * k);
  const h = Math.round(meta.height! * k);
  const { data: px } = await sharp(cut).resize(w, h).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // colori della base sotto il giocatore (sfocati: niente grana della base dentro la figura)
  const bm = await sharp(base).metadata();
  const ext = { left: Math.max(0, -at.x), top: Math.max(0, -at.y), right: Math.max(0, at.x + w - bm.width!), bottom: Math.max(0, at.y + h - bm.height!) };
  const region = { left: Math.max(0, at.x), top: Math.max(0, at.y), width: w - ext.left - ext.right, height: h - ext.top - ext.bottom };
  const under = await sharp(base)
    .extract(region)
    .extend({ ...ext, extendWith: "copy" })
    .blur(25)
    .removeAlpha()
    .raw()
    .toBuffer();
  const out = Buffer.alloc(w * h * 4);
  const rnd = noise(w * 31 + h);
  const H = bm.height!;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const r = px[p] / 255, g = px[p + 1] / 255, b = px[p + 2] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const n = rnd() * 0.07;
    for (let c = 0; c < 3; c++) {
      const col = under[i * 3 + c] / 255;
      const soft = lum < 0.5 ? 2 * lum * col + lum * lum * (1 - 2 * col) : 2 * lum * (1 - col) + Math.sqrt(lum) * (2 * col - 1);
      const orig = px[p + c] / 255;
      let v = orig * (1 - strength) + soft * strength;
      v = (v - 0.5) * 1.08 + 0.5 + n;
      out[p + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    let a = px[p + 3];
    if (fadeFrom !== undefined) {
      const y = at.y + Math.floor(i / w);
      if (y > fadeFrom) a = Math.round(a * Math.max(0.45, 1 - ((y - fadeFrom) / (H - fadeFrom)) * 0.55));
    }
    out[p + 3] = a;
  }
  const png = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return { src: toUri(png, "image/png"), x: at.x, y: at.y, w, h };
}

/**
 * Scontorno adattato a un'altezza (e a una larghezza massima), che in basso sfuma fino a `minAlpha`
 * dal punto `fadeAt` (frazione dell'altezza): il giocatore dell'MVP.
 */
export async function fadedCutout(src: string | Buffer, height: number, maxWidth: number, fadeAt = 0.78, minAlpha = 0.25): Promise<{ src: string; w: number; h: number } | null> {
  const cut = await trimmedCutout(src);
  if (!cut) return null;
  const meta = await sharp(cut).metadata();
  const k = Math.min(height / meta.height!, maxWidth / meta.width!);
  const w = Math.round(meta.width! * k);
  const h = Math.round(meta.height! * k);
  const { data } = await sharp(cut).resize(w, h).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const start = h * fadeAt;
  for (let y = Math.ceil(start); y < h; y++) {
    const f = 1 - ((y - start) / (h - start)) * (1 - minAlpha);
    for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = Math.round(data[(y * w + x) * 4 + 3] * f);
  }
  const png = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return { src: toUri(png, "image/png"), w, h };
}

/** Scontorno ridotto di un fattore fisso (i mezzo busto sono già tutti alla stessa scala). */
export async function scaledCutout(src: string | Buffer, k: number): Promise<{ src: string; w: number; h: number } | null> {
  const input = await load(src);
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) return null;
  const w = Math.round(meta.width! * k);
  const h = Math.round(meta.height! * k);
  const png = await sharp(input).resize(w, h).png().toBuffer();
  return { src: toUri(png, "image/png"), w, h };
}
