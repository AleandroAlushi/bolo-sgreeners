/**
 * Ritaglio del viso per il tondino dei giocatori (season_rosters.avatar_crop).
 *
 *   node --env-file=.env.local scripts/photos/avatar-crops.cjs [--tutte] [--prova]
 *
 * Per ogni foto di stagione senza ritaglio (con --tutte anche quelle che ce l'hanno) trova il viso
 * con MediaPipe Face Detector (Chrome headless, modello "blaze face", Apache 2.0) e salva un
 * quadrato attorno al viso con un po' di capelli: { x, y, s } in frazioni della LARGHEZZA della
 * foto. Funziona anche sulle caricature. --prova calcola e stampa senza salvare.
 * Serve Chrome installato e SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
const puppeteer = require("puppeteer-core");
const { createClient } = require("@supabase/supabase-js");

const all = process.argv.includes("--tutte");
const dry = process.argv.includes("--prova");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

/** Quadrato attorno al viso: lato 2,1 volte la larghezza del viso, un po' spostato in alto (capelli). */
function cropFor(face, w, h) {
  const side = Math.min(w, h, face.w * 2.1);
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2 - side * 0.08;
  const x = Math.max(0, Math.min(w - side, cx - side / 2));
  const y = Math.max(0, Math.min(h - side, cy - side / 2));
  const r = (v) => Math.round(v * 10000) / 10000;
  return { x: r(x / w), y: r(y / w), s: r(side / w) };
}

(async () => {
  if (!url || !key) throw new Error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });
  let q = db.from("season_rosters").select("season_id, player_id, photo_path, players(slug), seasons(slug)").not("photo_path", "is", null);
  if (!all) q = q.is("avatar_crop", null);
  const { data: rows, error } = await q;
  if (error) throw error;
  if (!rows.length) return console.log("Tutte le foto hanno già il ritaglio del viso.");

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({
    type: "module",
    content: `import { FilesetResolver, FaceDetector } from "${VISION}/vision_bundle.mjs";
      const files = await FilesetResolver.forVisionTasks("${VISION}/wasm");
      window.detector = await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: "${MODEL}" }, runningMode: "IMAGE", minDetectionConfidence: 0.3 });`,
  });
  await page.waitForFunction(() => window.detector, { timeout: 60000 });

  let saved = 0;
  for (const r of rows) {
    const src = /^https?:/.test(r.photo_path) ? r.photo_path : `${url}/storage/v1/object/public/media/${r.photo_path}`;
    const found = await page.evaluate(async (src) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      await img.decode();
      const best = window.detector.detect(img).detections.sort((a, b) => b.categories[0].score - a.categories[0].score)[0];
      const b = best?.boundingBox;
      return { w: img.naturalWidth, h: img.naturalHeight, face: b ? { x: b.originX, y: b.originY, w: b.width, h: b.height } : null };
    }, src);
    const label = `${r.seasons.slug} ${r.players.slug}`;
    if (!found.face) {
      console.log(`${label}: nessun viso trovato, resta senza ritaglio`);
      continue;
    }
    const crop = cropFor(found.face, found.w, found.h);
    console.log(`${label}: ${JSON.stringify(crop)}`);
    if (dry) continue;
    const { error: upErr } = await db.from("season_rosters").update({ avatar_crop: crop }).eq("season_id", r.season_id).eq("player_id", r.player_id);
    if (upErr) throw upErr;
    saved++;
  }
  await browser.close();
  console.log(dry ? "Prova: niente salvato." : `Ritagli salvati: ${saved}. Il sito li mostra entro un'ora (o subito salvando un giocatore in Admin).`);
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
