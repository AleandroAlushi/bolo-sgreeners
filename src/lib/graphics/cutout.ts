/**
 * Scontorno del giocatore nel browser dell'admin (MediaPipe, modello "selfie multiclass",
 * licenza Apache 2.0): dalla foto resta solo la persona su fondo trasparente, ritagliata attorno
 * alla figura. Gira solo lato client; il server riceve il PNG già pronto.
 */
import type { ImageSegmenter } from "@mediapipe/tasks-vision";

const VERSION = "1.1.1";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

let segmenter: Promise<ImageSegmenter> | null = null;

function load() {
  segmenter ??= import("@mediapipe/tasks-vision").then(async ({ FilesetResolver, ImageSegmenter }) => {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  });
  return segmenter;
}

async function toImage(source: Blob | string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = typeof source === "string" ? source : URL.createObjectURL(source);
  await img.decode();
  return img;
}

/** Foto → PNG con la sola persona (altezza massima `maxHeight`). Errore se non trova nessuno. */
export async function cutoutPerson(source: Blob | string, maxHeight = 1100): Promise<Blob> {
  const [seg, img] = await Promise.all([load(), toImage(source)]);
  // lavora al massimo a 1400 px sul lato lungo
  const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  const result = seg.segment(canvas);
  const mask = result.confidenceMasks?.[0];
  if (!mask) throw new Error("Scontorno non riuscito");
  // maschera 0 = sfondo: la persona è il resto. La maschera ha la stessa misura della tela.
  const bg = mask.getAsFloat32Array();
  const data = ctx.getImageData(0, 0, w, h);
  let top = h;
  let bottom = -1;
  let left = w;
  let right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // bordo morbido: da 0.3 a 0.7 di probabilità
      const t = Math.min(1, Math.max(0, (1 - bg[i] - 0.3) / 0.4));
      const a = t * t * (3 - 2 * t);
      data.data[i * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  result.close();
  if (bottom < 0 || (right - left) * (bottom - top) < w * h * 0.02) throw new Error("Nella foto non si vede nessuno");
  ctx.putImageData(data, 0, 0);

  // ritaglio attorno alla figura, con un po' di margine
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.03);
  const cx = Math.max(0, left - pad);
  const cy = Math.max(0, top - pad);
  const cw = Math.min(w, right + pad) - cx;
  const ch = Math.min(h, bottom + pad) - cy;
  const out = document.createElement("canvas");
  const k = Math.min(1, maxHeight / ch);
  out.width = Math.round(cw * k);
  out.height = Math.round(ch * k);
  out.getContext("2d")!.drawImage(canvas, cx, cy, cw, ch, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG non creato"))), "image/png"));
}
