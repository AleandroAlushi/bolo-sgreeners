// Video 4:5 per il post: ogni fotogramma verticale dentro una cornice da telefono, sullo sfondo Sgreeners.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const DIR = path.resolve(__dirname, "../../data/private/video/lavoro");
const OUT = path.join(DIR, "out45");
const SH = 1200, SW = Math.round((SH * 1080) / 1920), B = 10, R = 56;
const left = Math.round((1080 - SW - 2 * B) / 2), top = Math.round((1350 - SH - 2 * B) / 2);
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" rx="${R - B}" fill="#fff"/></svg>`);
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SW + 2 * B}" height="${SH + 2 * B}"><rect x="1" y="1" width="${SW + 2 * B - 2}" height="${SH + 2 * B - 2}" rx="${R}" fill="#050505" stroke="#2c2c2c" stroke-width="3"/></svg>`,
  );
  const shadow = await sharp({ create: { width: SW + 2 * B + 80, height: SH + 2 * B + 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: frame, left: 40, top: 48 }])
    .blur(22)
    .linear([1, 1, 1, 0.6], [0, 0, 0, 0])
    .png()
    .toBuffer();
  const bg = await sharp(path.join(DIR, "post-sfondo-video.png"))
    .composite([
      { input: shadow, left: left - 40, top: top - 40 },
      { input: frame, left, top },
    ])
    .toBuffer();
  const files = fs.readdirSync(path.join(DIR, "out")).sort();
  for (let i = 0; i < files.length; i++) {
    const screen = await sharp(path.join(DIR, "out", files[i])).resize(SW, SH).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    await sharp(bg).composite([{ input: screen, left: left + B, top: top + B }]).jpeg({ quality: 90 }).toFile(path.join(OUT, files[i]));
    if (i % 400 === 0) console.log(i, "/", files.length);
  }
  console.log("ok", files.length);
})();
