// Registra un giro del sito come da telefono (432x768 css, x2.5 = 1080x1920) con lo screencast
// di Chrome: salva i fotogrammi con il loro istante e un registro di scritte e tocchi.
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const SITE = "https://bolo-sgreeners.vercel.app";
const WORK = require("path").resolve(__dirname, "../../data/private/video/lavoro");
require("fs").mkdirSync(WORK, { recursive: true });
const OUT = path.join(WORK, "rec");
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
    args: ["--hide-scrollbars", "--lang=it-IT", "--force-device-scale-factor=2.5"],
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
  await page.setViewport({ width: 432, height: 768, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

  // come l'app installata sul telefono, con notifiche "finte": nessuna iscrizione vera nel database
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "standalone", { get: () => true });
    let perm = "default";
    let sub = null;
    const fake = { endpoint: "https://example.invalid/push/video", toJSON: () => ({ endpoint: "https://example.invalid/push/video", keys: { p256dh: "x", auth: "y" } }), unsubscribe: async () => ((sub = null), true) };
    const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => (sub = fake) } };
    const N = function () {};
    N.requestPermission = async () => (perm = "granted");
    Object.defineProperty(N, "permission", { get: () => perm });
    window.Notification = N;
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg), addEventListener() {}, removeEventListener() {} } });
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (/\/rest\/v1\/rpc\/push_(un)?subscribe/.test(req.url())) {
      const cors = { "Access-Control-Allow-Origin": "https://bolo-sgreeners.vercel.app", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Credentials": "true" };
      req.respond({ status: 204, headers: cors, body: "" });
    }
    else req.continue();
  });
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

  // si parte già sulla home, poi si accende la registrazione
  await go("/");
  // un input vero attiva la pagina (React la idrata al primo evento), poi si aspetta il pulsante
  await page.mouse.move(216, 500);
  await page.mouse.wheel({ deltaY: 40 });
  await sleep(300);
  await page.mouse.wheel({ deltaY: -40 });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Attiva"), { timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await client.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  mark("start");
  await sleep(400);

  // 1. home
  caption("La web app dei", "Bolo Sgreeners");
  await sleep(1800);
  await scroll(380, 1600);
  caption("Record, punti e classifica", "sempre aggiornati");
  await sleep(1400);
  const notify = await byText("button", "Attiva");
  await scrollTo(notify, 0.42, 1700);
  caption("Notifiche delle partite", "il giorno, un'ora prima e il risultato");
  await sleep(1100);
  await tap(notify);
  await sleep(2300);
  const next = await page.$('a[href^="/partite/54f7d261"]');
  await scrollTo(next, 0.25, 1300);
  caption("La prossima partita", "data, ora e palestra");
  await sleep(1300);
  await tap(next);
  await sleep(1600);

  // 2. partita in programma: indicazioni
  mark("match");
  caption("Indicazioni per la palestra", "in un tocco");
  const dir = await byText("button", "Indicazioni");
  await scrollTo(dir, 0.55, 900);
  await sleep(500);
  await tap(dir);
  await sleep(2400);
  await page.keyboard.press("Escape");
  await sleep(500);

  // 3. ultima partita: box score ordinabile
  await go("/partite/8fdbe34c-df2c-49ca-a213-dfb9e2323553");
  mark("result");
  caption("Risultati e tabellini", "di ogni partita");
  await sleep(1300);
  await scroll(420, 1500);
  await sleep(500);
  const box = await byText("button", "Ordina per punti");
  await scrollTo(box, 0.22, 1300);
  caption("Box score completo", "tocca una voce per ordinarlo");
  await sleep(900);
  await tap(box);
  await sleep(1300);
  const reb = await byText("button", "Ordina per rimbalzi difensivi");
  await tap(reb);
  await sleep(1500);

  // 4. statistiche di stagione
  await go("/stagioni/2025-26/statistiche");
  mark("stats");
  caption("Statistiche e leader", "di ogni stagione");
  await sleep(1200);
  await scroll(650, 2300);
  await sleep(700);
  const tab30 = await byText("[role=tab]", "Per 30 minuti");
  await scrollTo(tab30, 0.18, 1400);
  caption("Totali, medie", "e valori per 30 minuti");
  await sleep(600);
  await tap(tab30);
  await sleep(1300);
  const table = await page.$("table.stat-table");
  await scrollTo(table, 0.14, 1500);
  caption("Tocca una voce", "e la tabella si ordina");
  await sleep(500);
  const pts = await byText("table button", "Ordina per punti");
  await tap(pts);
  await sleep(1500);
  const tl = await byText("table button", "Ordina per % tiri liberi");
  await tap(tl);
  await sleep(1500);

  // 5. classifica
  await go("/stagioni/2026-27/classifica");
  mark("table");
  caption("Classifica e calendario", "del girone");
  await sleep(1300);
  await scroll(300, 1400);
  await sleep(900);

  // 6. squadra
  await go("/stagioni/2024-25/squadra");
  mark("team");
  caption("Le figurine", "della squadra");
  await sleep(900);
  await scroll(1500, 3600);
  await sleep(600);

  // 7. tema chiaro / scuro
  await scroll(-1500, 1200);
  const theme = await page.$('button[aria-label="Cambia tema chiaro o scuro"]');
  caption("Tema chiaro", "o scuro");
  await sleep(500);
  await tap(theme);
  await sleep(1100);
  await scroll(700, 1800);
  await sleep(600);
  await scroll(-700, 1200);
  await sleep(300);
  await tap(theme);
  await sleep(1300);
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
