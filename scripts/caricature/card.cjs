/**
 * Card di un giocatore dalla caricatura fatta con Gemini (vedi NOTE.md, "Caricature").
 *
 *   node scripts/caricature/card.cjs <disegno> <uscita.jpg> [--chiave magenta|verde] [--ombra]
 *
 * - Il disegno deve avere lo sfondo pieno magenta #FF00FF (o verde #00FF00 se il personaggio ha
 *   rosa/viola). Il colore esatto si misura dai bordi; la trasparenza si calcola pixel per pixel
 *   dalla quantità di colore chiave e sui bordi si toglie il riflesso di quel colore.
 * - Lo sfondo della card è la sfumatura Sgreeners (nero → verde → giallo → arancio), 1080×1350.
 * - --ombra aggiunge un'ombra morbida a terra (se Gemini non l'ha disegnata).
 * - Scrive anche <uscita>-figurina.jpg a 900×1125, il formato delle foto della pagina Squadra.
 */
const sharp = require("sharp");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const [input, output] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--chiave"));
if (!input || !output) {
  console.error("Uso: node scripts/caricature/card.cjs <disegno> <uscita.jpg> [--chiave magenta|verde] [--ombra]");
  process.exit(1);
}
const mode = opt("--chiave", "magenta");
const W = 1080, H = 1350;

/** Personaggio su fondo trasparente, da uno sfondo pieno magenta o verde. */
async function cutout(file) {
  // quanto un pixel "è" colore chiave: magenta min(R,B) − G, verde G − max(R,B)
  const keyness = mode === "verde" ? (r, g, b) => g - Math.max(r, b) : (r, g, b) => Math.min(r, b) - g;
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // colore dello sfondo misurato sui bordi: Gemini non dà sempre un #FF00FF puro
  const border = [];
  for (let x = 0; x < w; x += 4) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 4) border.push(y * w, y * w + w - 1);
  const samples = border.map((p) => [data[p * 3], data[p * 3 + 1], data[p * 3 + 2]]).filter(([r, g, b]) => keyness(r, g, b) > 60);
  if (samples.length < border.length * 0.5) throw new Error(`sfondo non ${mode}: controlla il disegno o usa --chiave`);
  const median = (k) => samples.map((c) => c[k]).sort((a, b) => a - b)[samples.length >> 1];
  const KEY = [median(0), median(1), median(2)];
  const keyK = keyness(...KEY);
  // sopra HIGH è sfondo, sotto LOW personaggio pieno, in mezzo il bordo sfumato
  const HIGH = keyK - 18, LOW = Math.max(20, HIGH - 110);
  console.log(`sfondo misurato: rgb(${KEY.join(", ")})`);
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 3, o = p * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = Math.min(1, Math.max(0, (HIGH - keyness(r, g, b)) / (HIGH - LOW)));
    let rr = r, gg = g, bb = b;
    if (a > 0 && a < 1) {
      // bordo: separa il colore del personaggio da quello della chiave
      rr = (r - (1 - a) * KEY[0]) / a;
      gg = (g - (1 - a) * KEY[1]) / a;
      bb = (b - (1 - a) * KEY[2]) / a;
    }
    // riflesso del colore chiave (bordi, bianchi): verso il neutro
    if (mode === "verde") gg = Math.min(gg, Math.max(rr, bb));
    else {
      const spill = Math.min(rr, bb) - gg;
      if (spill > 0) { rr -= spill; bb -= spill; }
    }
    out[o] = Math.max(0, Math.min(255, Math.round(rr)));
    out[o + 1] = Math.max(0, Math.min(255, Math.round(gg)));
    out[o + 2] = Math.max(0, Math.min(255, Math.round(bb)));
    out[o + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

(async () => {
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#0a0b0a"/><stop offset="0.38" stop-color="#0c2414"/><stop offset="0.68" stop-color="#19d35e"/>` +
      `<stop offset="0.86" stop-color="#d9d21c"/><stop offset="1" stop-color="#f2a20c"/></linearGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
  );
  // personaggio alto quanto la card meno un margine, centrato e appoggiato in basso
  const fig = await sharp(await cutout(input)).trim().resize({ height: 1230, width: 1000, fit: "inside" }).toBuffer({ resolveWithObject: true });
  const layers = [];
  if (flag("--ombra")) {
    const ow = Math.round(fig.info.width * 0.72);
    const shadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ow + 80}" height="110"><ellipse cx="${(ow + 80) / 2}" cy="55" rx="${ow / 2}" ry="24" fill="#000" fill-opacity="0.45"/></svg>`);
    layers.push({ input: await sharp(shadow).blur(14).png().toBuffer(), left: Math.round((W - ow - 80) / 2), top: H - 120 });
  }
  layers.push({ input: fig.data, left: Math.round((W - fig.info.width) / 2), top: H - fig.info.height - 50 });
  const card = await sharp(bg).composite(layers).jpeg({ quality: 92 }).toBuffer();
  await sharp(card).toFile(output);
  const figurina = output.replace(/\.jpe?g$/i, "") + "-figurina.jpg";
  await sharp(card).resize(900, 1125, { fit: "cover" }).jpeg({ quality: 88, mozjpeg: true }).toFile(figurina);
  console.log(`card: ${output}\nfigurina per il sito: ${figurina}`);
})();
