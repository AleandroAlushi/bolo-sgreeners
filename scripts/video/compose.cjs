// Montaggio: apertura, giro registrato (senza i caricamenti), scritte, tocchi, chiusura → JPEG a 30 fps.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "../../data/private/video/lavoro");
const OUT = path.join(DIR, "out");
const FPS = 30;
const W = 1080, H = 1920;
const INTRO = 2.0, OUTRO = 3.0, FADE = 0.35;
/** durata totale voluta (secondi): il giro si accelera in modo uniforme per starci */
const TARGET = 60;

const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Una registrazione tra due istanti, senza i caricamenti nascosti: fotogrammi, scritte e tocchi in secondi dal suo inizio. */
function segment(dir, fromT, toT, extraHidden = []) {
  const events = JSON.parse(fs.readFileSync(path.join(DIR, dir, "events.json"), "utf8"));
  const hidden = [...extraHidden];
  let open = null;
  for (const e of events) {
    if (e.type === "hide") open = e.t;
    if (e.type === "show" && open !== null) { hidden.push([open, e.t]); open = null; }
  }
  const isHidden = (t) => hidden.some(([a, b]) => t >= a && t < b);
  const map = (t) => t - fromT - hidden.filter(([a, b]) => b <= t && a >= fromT).reduce((s, [a, b]) => s + (b - a), 0);
  const inside = (t) => t >= fromT && t < toT && !isHidden(t);
  hidden.sort((a, b) => a[0] - b[0]);
  // quello che è sullo schermo all'inizio del pezzo: l'ultimo fotogramma arrivato prima (lo
  // screencast manda fotogrammi solo quando qualcosa cambia)
  const before = [...events].reverse().find((e) => e.type === "frame" && e.t <= fromT);
  const frames = events.filter((e) => e.type === "frame" && inside(e.t)).map((f) => ({ v: map(f.t), file: path.join(dir, "frames", f.file) }));
  if (before && !(frames[0] && frames[0].v <= 0.001)) frames.unshift({ v: 0, file: path.join(dir, "frames", before.file) });
  return {
    dir,
    duration: map(toT),
    frames,
    captions: events.filter((e) => e.type === "caption" && inside(e.t)).map((c) => ({ v: map(c.t), file: `overlays/caption-${slug(c.text)}.png` })),
    taps: events.filter((e) => e.type === "tap" && inside(e.t)).map((e) => ({ v: map(e.t) + 0.3, x: e.x, y: e.y })),
  };
}
const main = JSON.parse(fs.readFileSync(path.join(DIR, "rec/events.json"), "utf8"));
const live = JSON.parse(fs.readFileSync(path.join(DIR, "rec-live/events.json"), "utf8"));
const first = (ev) => ev.find((e) => e.type === "frame").t;
const markT = (ev, name) => ev.find((e) => e.type === "mark" && e.name === name).t;
// la diretta va dopo la partita di stasera: si taglia al caricamento della pagina dei risultati
const resultMark = markT(main, "result");
const cutHide = [...main].reverse().find((e) => e.type === "hide" && e.t < resultMark);
const cutShow = main.find((e) => e.type === "show" && e.t > cutHide.t);
const capT = (ev, text) => ev.find((e) => e.type === "caption" && e.text === text).t;
// senza i valori per 30' (da "Totali, medie" fino alla classifica) e senza il tema chiaro/scuro
const tableMark = markT(main, "table");
const tableHide = [...main].reverse().find((e) => e.type === "hide" && e.t < tableMark);
const tableShow = main.find((e) => e.type === "show" && e.t > tableHide.t);
const matchMark = markT(main, "match");
const tapNext = [...main].reverse().find((e) => e.type === "tap" && e.t < matchMark);
const segs = [
  segment("rec", first(main), cutHide.t, [[tapNext.t + 0.4, matchMark - 1.2]]),
  segment("rec-live", first(live), markT(live, "end")),
  segment("rec", cutShow.t, capT(main, "Totali, medie") - 0.2),
  segment("rec", tableShow.t, capT(main, "Tema chiaro") - 1.8),
];
const raw = segs.reduce((s, x) => s + x.duration, 0);
const SPEED = Math.max(1, raw / (TARGET - INTRO - OUTRO));
for (const s of segs) {
  s.duration /= SPEED;
  for (const f of s.frames) f.v /= SPEED;
  for (const c of s.captions) c.v /= SPEED;
  for (const t of s.taps) t.v /= SPEED;
}
console.log("giro registrato", raw.toFixed(1), "s, velocità", SPEED.toFixed(2) + "x");
let acc = 0;
for (const s of segs) { s.start = acc; acc += s.duration; }
const tourEnd = acc;
const shown = segs.flatMap((s) => s.frames.map((f) => ({ v: f.v + s.start, file: f.file })));
const captions = segs.flatMap((s) => s.captions.map((c) => ({ v: c.v + s.start, file: c.file })));
const taps = segs.flatMap((s) => s.taps.map((t) => ({ ...t, v: t.v + s.start })));
// ogni segmento ricomincia senza la scritta del precedente finché non arriva la sua
const segStarts = segs.map((s) => s.start);

const cache = new Map();
async function rgba(file) {
  if (!cache.has(file)) cache.set(file, await sharp(path.join(DIR, file)).ensureAlpha().raw().toBuffer());
  return cache.get(file);
}
/** PNG trasparente con l'alfa moltiplicata (dissolvenze), in cache per livelli di opacità. */
async function faded(file, alpha, dy = 0) {
  const key = `${file}@${alpha.toFixed(2)}@${dy}`;
  if (!cache.has(key)) {
    const src = await rgba(file);
    const buf = Buffer.from(src);
    for (let i = 3; i < buf.length; i += 4) buf[i] = Math.round(buf[i] * alpha);
    let img = sharp(buf, { raw: { width: W, height: H, channels: 4 } });
    if (dy) {
      // in due passaggi: nella stessa catena sharp ritaglierebbe prima di allungare
      const tall = await img.extend({ top: dy, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      img = sharp(tall).extract({ left: 0, top: 0, width: W, height: H });
    }
    cache.set(key, await img.png().toBuffer());
  }
  return cache.get(key);
}
const ripple = (x, y, p) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<circle cx="${x}" cy="${y}" r="${(36 + 80 * p).toFixed(1)}" fill="none" stroke="#19d35e" stroke-width="10" stroke-opacity="${(0.9 * (1 - p)).toFixed(2)}"/>` +
      `<circle cx="${x}" cy="${y}" r="34" fill="#ffffff" fill-opacity="${(0.45 * (1 - p)).toFixed(2)}"/>` +
      `</svg>`,
  );

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const total = INTRO + tourEnd + OUTRO;
  const n = Math.round(total * FPS);
  const intro = await sharp(path.join(DIR, "overlays/intro.png")).flatten({ background: "#0a0b0a" }).toBuffer();
  const outro = await sharp(path.join(DIR, "overlays/outro.png")).flatten({ background: "#0a0b0a" }).toBuffer();
  let k = 0;
  for (let i = 0; i < n; i++) {
    const T = i / FPS;
    let img;
    if (T < INTRO) {
      // apertura: zoom lento
      const z = 1 + 0.06 * (T / INTRO);
      const zw = Math.round(W * z), zh = Math.round(H * z);
      img = sharp(await sharp(intro).resize(zw, zh).extract({ left: Math.round((zw - W) / 2), top: Math.round((zh - H) / 2), width: W, height: H }).toBuffer());
      // dissolvenza verso il sito
      if (T > INTRO - FADE) {
        const a = (T - (INTRO - FADE)) / FADE;
        const first = await sharp(path.join(DIR, shown[0].file)).ensureAlpha(a).toBuffer();
        img = sharp(await img.composite([{ input: first }]).toBuffer());
      }
    } else if (T < INTRO + tourEnd) {
      const v = T - INTRO;
      let f = shown[0];
      for (const s of shown) { if (s.v <= v) f = s; else break; }
      const layers = [];
      for (const tp of taps) {
        const p = (v - tp.v) / 0.55;
        if (p >= 0 && p < 1) layers.push({ input: ripple(tp.x, tp.y, p) });
      }
      const segStart = [...segStarts].reverse().find((x) => x <= v) ?? 0;
      const cap = [...captions].reverse().find((c) => c.v <= v && c.v >= segStart - 0.001);
      if (cap) {
        const p = Math.min(1, (v - cap.v) / 0.3);
        const e = 1 - Math.pow(1 - p, 3);
        layers.push({ input: await faded(cap.file, Math.round(e * 10) / 10, Math.round((1 - e) * 4) * 10) });
      }
      img = sharp(path.join(DIR, f.file));
      if (layers.length) img = sharp(await img.composite(layers).toBuffer());
      // dissolvenza verso la chiusura
      if (v > tourEnd - FADE) {
        const a = (v - (tourEnd - FADE)) / FADE;
        img = sharp(await img.composite([{ input: await sharp(outro).ensureAlpha(a).toBuffer() }]).toBuffer());
      }
    } else {
      img = sharp(outro);
    }
    await img.jpeg({ quality: 90 }).toFile(path.join(OUT, `o${String(k++).padStart(5, "0")}.jpg`));
    if (k % 300 === 0) console.log(k, "/", n);
  }
  console.log("fotogrammi", k, "durata", total.toFixed(1), "s");
})();
