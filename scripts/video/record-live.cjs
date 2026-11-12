// Registra un giro del sito come da telefono (432x768 css, x2.5 = 1080x1920) con lo screencast
// di Chrome: salva i fotogrammi con il loro istante e un registro di scritte e tocchi.
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const SITE = process.env.SITE || "https://bolo-sgreeners.vercel.app";
const WORK = require("path").resolve(__dirname, "../../data/private/video/lavoro");
require("fs").mkdirSync(WORK, { recursive: true });
const OUT = path.join(WORK, process.env.OUTDIR || "rec");
const SCALE = 2.5;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });
const events = [];
const now = () => Date.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--hide-scrollbars", "--disable-notifications", "--lang=it-IT", "--force-device-scale-factor=2.5"],
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
  await page.setViewport({ width: 432, height: 768, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

  const client = await page.createCDPSession();
  let n = 0;
  client.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = `f${String(n++).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(OUT, "frames", file), Buffer.from(data, "base64"));
    events.push({ type: "frame", t: metadata.timestamp, file });
    client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });

  const caption = (text, sub = "") => events.push({ type: "caption", t: now(), text, sub });
  const mark = (name) => events.push({ type: "mark", t: now(), name });

  // scroll morbido (ease in-out) di dy pixel in ms millisecondi
  const scroll = (dy, ms) =>
    page.evaluate(
      (dy, ms) =>
        new Promise((res) => {
          const y0 = window.scrollY;
          const t0 = performance.now();
          const step = (t) => {
            const p = Math.min(1, (t - t0) / ms);
            const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            window.scrollTo(0, y0 + dy * e);
            if (p < 1) requestAnimationFrame(step);
            else res();
          };
          requestAnimationFrame(step);
        }),
      dy,
      ms,
    );
  // porta un elemento a una certa altezza dello schermo (frazione), con scroll morbido
  const scrollTo = async (handle, at = 0.3, ms = 1200) => {
    const box = await handle.boundingBox();
    if (box) await scroll(box.y - 768 * at, ms);
  };
  const tap = async (handle, pause = 350) => {
    const box = await handle.boundingBox();
    if (!box) throw new Error("elemento non visibile");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    events.push({ type: "tap", t: now(), x: x * SCALE, y: y * SCALE });
    await sleep(pause);
    await page.touchscreen.tap(x, y);
  };
  const byText = async (selector, text) => {
    const handles = await page.$$(selector);
    for (const h of handles) {
      const t = await h.evaluate((el) => ([el.getAttribute("aria-label"), el.getAttribute("title"), el.textContent].filter(Boolean).join(" ")).trim());
      if (t.includes(text)) return h;
    }
    throw new Error(`non trovato: ${selector} "${text}"`);
  };
  // cambio pagina "a taglio": nel montaggio il caricamento non si vede
  const go = async (url) => {
    events.push({ type: "hide", t: now() });
    await page.goto(SITE + url, { waitUntil: "networkidle2" });
    await sleep(900);
    events.push({ type: "show", t: now() });
  };

  const { execSync } = require("child_process");
  const psql = (sql) => execSync(`/opt/homebrew/opt/postgresql@17/bin/psql -q -c "${sql}"`, { env: { ...process.env, PGHOST: "/tmp", PGPORT: "54329", PGUSER: "postgres", PGDATABASE: "bolo" } });
  // niente indicatore di sviluppo di Next nel video
  await page.evaluateOnNewDocument(() => {
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
  });
  // orologio della diretta fermo a 4:22 del 3° quarto e che riparte adesso
  psql("update live_games set clock_remaining = 262, clock_running = true, clock_updated_at = now()");
  await go("/");
  const banner = await page.waitForSelector('a[href="/partite/4ae59514-165a-45aa-b692-0f267a238094"].lift', { timeout: 15000 });
  await scrollTo(banner, 0.13, 10);
  await sleep(600);
  await client.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  mark("start");
  await sleep(300);
  caption("Si gioca stasera?", "segui la partita in diretta");
  await sleep(1800);
  await tap(banner);
  await sleep(150);
  events.push({ type: "hide", t: now() });
  await sleep(1500);
  events.push({ type: "show", t: now() });
  await sleep(300);
  caption("Punteggio e tempo live", "si aggiorna da solo");
  await sleep(1200);
  // arriva una tripla: entro qualche secondo il punteggio cambia
  execSync(`/opt/homebrew/opt/postgresql@17/bin/psql -q -f ${path.join(WORK, "live-tripla.sql")}`, { env: { ...process.env, PGHOST: "/tmp", PGPORT: "54329", PGUSER: "postgres", PGDATABASE: "bolo" } });
  await sleep(5200);
  caption("Andamento e tabellino", "canestro dopo canestro");
  await scroll(520, 1800);
  await sleep(1300);
  await scroll(560, 1700);
  await sleep(1500);
  mark("end");
  await client.send("Page.stopScreencast");
  await sleep(300);
  fs.writeFileSync(path.join(OUT, "events.json"), JSON.stringify(events, null, 1));
  console.log("fotogrammi", n, "eventi", events.filter((e) => e.type !== "frame").length);
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  fs.writeFileSync(path.join(OUT, "events.json"), JSON.stringify(events, null, 1));
  process.exit(1);
});
