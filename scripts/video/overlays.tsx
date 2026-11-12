/**
 * Grafiche del video promo (1080×1920): scritte dei passaggi, apertura e chiusura, nello stile
 * Sgreeners. Legge le scritte dalle registrazioni (rec/ e rec-live/ in data/private/video/lavoro).
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/video/overlays.tsx
 */
import { ImageResponse } from "next/og";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { socialAssets } from "../../src/lib/graphics/social/assets";

const WORK = join(process.cwd(), "data/private/video/lavoro");
const OUT = join(WORK, "overlays");
const W = 1080, H = 1920;
const NEON = "linear-gradient(90deg, #19d35e 0%, #d9d21c 55%, #f2a20c 100%)";
/** scritte da mettere in alto perché sotto c'è quello da far vedere (es. il menu delle indicazioni) */
const TOP = new Set(["Indicazioni per la palestra"]);
const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Ev = { type: string; text?: string; sub?: string };
const read = (dir: string): Ev[] => (existsSync(join(WORK, dir, "events.json")) ? JSON.parse(readFileSync(join(WORK, dir, "events.json"), "utf8")) : []);

(async () => {
  mkdirSync(OUT, { recursive: true });
  const a = await socialAssets();
  const save = async (el: ReactElement, file: string) => {
    const r = new ImageResponse(el, { width: W, height: H, fonts: a.fonts });
    writeFileSync(join(OUT, file), Buffer.from(await r.arrayBuffer()));
  };
  const caps = [...new Map([...read("rec"), ...read("rec-live")].filter((e) => e.type === "caption").map((c) => [c.text!, c])).values()];
  for (const c of caps) {
    const size = c.text!.length > 22 ? 88 : 104;
    await save(
      <div style={{ display: "flex", width: W, height: H, alignItems: "flex-start", justifyContent: "center", paddingTop: TOP.has(c.text!) ? 300 : 1170 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 6, borderRadius: 34, backgroundImage: NEON, boxShadow: "0 18px 50px rgba(0,0,0,0.55)", maxWidth: 980 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 50px 30px", borderRadius: 30, backgroundColor: "rgba(8,9,8,0.94)" }}>
            <span style={{ fontFamily: "Bebas", fontSize: size, color: "#f6efe9", lineHeight: 1, letterSpacing: 1, textAlign: "center", whiteSpace: "nowrap" }}>{c.text}</span>
            {c.sub && <span style={{ fontFamily: "Playfair", fontStyle: "italic", fontSize: c.sub.length > 32 ? 48 : 56, color: "#19d35e", lineHeight: 1.1, marginTop: 8, textAlign: "center", whiteSpace: "nowrap" }}>{c.sub}</span>}
          </div>
        </div>
      </div>,
      `caption-${slug(c.text!)}.png`,
    );
  }
  const Stage = ({ children }: { children: ReactNode }) => (
    <div style={{ display: "flex", width: W, height: H, position: "relative", backgroundColor: "#0a0b0a", overflow: "hidden", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: "radial-gradient(ellipse at 50% 45%, rgba(25,211,94,0.35) 0%, rgba(10,11,10,0) 60%)" }} />
      <div style={{ display: "flex", position: "absolute", left: 0, bottom: 0, width: W, height: 700, backgroundImage: "linear-gradient(180deg, rgba(10,11,10,0) 0%, rgba(242,162,12,0.28) 100%)" }} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: `url(${a.grain})`, backgroundSize: "256px 256px", opacity: 0.35 }} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: W, height: 16, backgroundImage: NEON }} />
      <div style={{ display: "flex", position: "absolute", left: 0, bottom: 0, width: W, height: 16, backgroundImage: NEON }} />
      {children}
    </div>
  );
  await save(
    <Stage>
      {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
      <img src={a.logo} width={560} height={414} style={{ width: 560, height: 414 }} alt="" />
      <span style={{ fontFamily: "Bebas", fontSize: 168, color: "#f6efe9", lineHeight: 0.9, marginTop: 50, whiteSpace: "nowrap" }}>BOLO SGREENERS</span>
      <span style={{ fontFamily: "Playfair", fontStyle: "italic", fontSize: 92, color: "#19d35e", marginTop: 16 }}>l&apos;app della squadra</span>
      <span style={{ fontFamily: "Barlow", fontSize: 44, color: "rgba(246,239,233,0.7)", marginTop: 40, letterSpacing: 6 }}>BASKET CSI · BOLOGNA</span>
    </Stage>,
    "intro.png",
  );
  await save(
    <Stage>
      {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
      <img src={a.logo} width={380} height={281} style={{ width: 380, height: 281 }} alt="" />
      <span style={{ fontFamily: "Bebas", fontSize: 150, color: "#f6efe9", lineHeight: 0.95, marginTop: 40 }}>PROVALA ORA</span>
      <div style={{ display: "flex", marginTop: 30, padding: 6, borderRadius: 30, backgroundImage: NEON }}>
        <span style={{ display: "flex", padding: "22px 44px", borderRadius: 26, backgroundColor: "#0a0b0a", fontFamily: "Barlow", fontWeight: 600, fontSize: 60, color: "#f6efe9" }}>bolo-sgreeners.vercel.app</span>
      </div>
      <span style={{ fontFamily: "Playfair", fontStyle: "italic", fontSize: 58, color: "#19d35e", marginTop: 60, textAlign: "center", maxWidth: 900 }}>Condividi → Aggiungi alla schermata Home</span>
      <span style={{ fontFamily: "Barlow", fontSize: 44, color: "rgba(246,239,233,0.7)", marginTop: 26 }}>e diventa un&apos;app sul telefono</span>
      <span style={{ fontFamily: "Bebas", fontSize: 80, color: "#f2a20c", marginTop: 90 }}>#BOLOSGREENERS</span>
    </Stage>,
    "outro.png",
  );
  console.log("grafiche:", caps.length, "scritte + apertura e chiusura in", OUT);
})();
