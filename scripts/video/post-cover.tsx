import { ImageResponse } from "next/og";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { socialAssets } from "../../src/lib/graphics/social/assets";
import { Arc, Condensed, CourtTexture, Grain, VBar } from "../../src/lib/graphics/social/parts";

const V = join(process.cwd(), "data/private/video/lavoro");
const NEON = "linear-gradient(90deg, #19d35e 0%, #d9d21c 55%, #f2a20c 100%)";
const shot = "data:image/jpeg;base64," + readFileSync(`${V}/rec/frames/f00005.jpg`).toString("base64");

(async () => {
  const a = await socialAssets();
  const W = 1080, H = 1350;
  const SW = 430, SH = Math.round((SW * 1920) / 1080);
  const r = new ImageResponse(
    <div style={{ display: "flex", width: W, height: H, position: "relative", backgroundColor: "#0a0b0a", overflow: "hidden", color: "#f6efe9", fontFamily: "Barlow" }}>
      <CourtTexture width={W} height={H} seed={5} />
      <VBar left={-60} width={240} height={900} stops="rgba(40,200,230,0) 0%, rgba(40,200,230,0.85) 15%, rgba(60,226,150,0.85) 45%, rgba(214,220,30,0.8) 70%, rgba(10,11,10,0) 100%" />
      <VBar left={900} top={300} width={240} height={1050} stops="rgba(242,162,12,0) 0%, rgba(242,162,12,0.7) 35%, rgba(60,226,150,0.75) 70%, rgba(10,11,10,0) 100%" />
      <Grain src={a.grain} width={W} height={H} opacity={0.45} />
      <Arc cx={540} cy={1560} r={700} opacity={0.45} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: W, height: 14, backgroundImage: NEON }} />
      <img src={a.logo} width={150} height={111} style={{ position: "absolute", left: 60, top: 54, width: 150, height: 111 }} />
      <span style={{ position: "absolute", left: 230, top: 92, fontFamily: "Playfair", fontStyle: "italic", fontSize: 44, color: "#19d35e" }}>Bolo Sgreeners presenta</span>
      <Condensed text="NUOVA" cap={190} left={58} top={250} squeeze={0.74} />
      <Condensed text="APP" cap={190} left={58} top={480} squeeze={0.74} color="#19d35e" />
      <span style={{ position: "absolute", left: 62, top: 730, width: 470, fontSize: 38, lineHeight: 1.3, color: "rgba(246,239,233,0.88)", display: "flex" }}>
        Partite, diretta, statistiche, classifica e notifiche: tutto sugli Sgreeners nel telefono.
      </span>
      <div style={{ position: "absolute", left: 62, top: 1030, display: "flex", padding: 5, borderRadius: 26, backgroundImage: NEON }}>
        <span style={{ display: "flex", padding: "16px 30px", borderRadius: 22, backgroundColor: "#0a0b0a", fontWeight: 600, fontSize: 38 }}>bolo-sgreeners.vercel.app</span>
      </div>
      <span style={{ position: "absolute", left: 62, top: 1170, fontFamily: "Bebas", fontSize: 54, color: "#f2a20c", letterSpacing: 2 }}>SCORRI PER IL VIDEO →</span>
      {/* telefono con la home: schermo nelle stesse proporzioni dello screenshot */}
      <div style={{ position: "absolute", left: 572, top: 165, display: "flex", padding: 14, borderRadius: 64, backgroundColor: "#050505", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", border: "4px solid #2a2a2a" }}>
        <div style={{ display: "flex", width: SW, height: SH, borderRadius: 50, overflow: "hidden" }}>
          <img src={shot} width={SW} height={SH} style={{ width: SW, height: SH }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 572, top: 165 + SH + 50, width: SW + 36, display: "flex", justifyContent: "center", fontFamily: "Playfair", fontStyle: "italic", fontSize: 40, color: "#19d35e" }}>Aggiungila alla Home</div>
    </div>,
    { width: W, height: H, fonts: a.fonts },
  );
  writeFileSync(`${V}/post-copertina.png`, Buffer.from(await r.arrayBuffer()));
  console.log("ok", SH);
})();
