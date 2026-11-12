import { ImageResponse } from "next/og";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { socialAssets } from "../../src/lib/graphics/social/assets";
import { Arc, CourtTexture, Grain, VBar } from "../../src/lib/graphics/social/parts";

const NEON = "linear-gradient(90deg, #19d35e 0%, #d9d21c 55%, #f2a20c 100%)";
(async () => {
  const a = await socialAssets();
  const W = 1080, H = 1350;
  const r = new ImageResponse(
    <div style={{ display: "flex", width: W, height: H, position: "relative", backgroundColor: "#0a0b0a", overflow: "hidden" }}>
      <CourtTexture width={W} height={H} seed={5} />
      <VBar left={-60} width={240} height={900} stops="rgba(40,200,230,0) 0%, rgba(40,200,230,0.85) 15%, rgba(60,226,150,0.85) 45%, rgba(214,220,30,0.8) 70%, rgba(10,11,10,0) 100%" />
      <VBar left={900} top={300} width={240} height={1050} stops="rgba(242,162,12,0) 0%, rgba(242,162,12,0.7) 35%, rgba(60,226,150,0.75) 70%, rgba(10,11,10,0) 100%" />
      <Grain src={a.grain} width={W} height={H} opacity={0.45} />
      <Arc cx={540} cy={1560} r={700} opacity={0.45} />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: W, height: 14, backgroundImage: NEON }} />
      <img src={a.logo} width={140} height={104} style={{ position: "absolute", left: 22, top: 44, width: 140, height: 104 }} />
      <div style={{ position: "absolute", left: 30, top: 1150, display: "flex", flexDirection: "column", fontFamily: "Bebas", fontSize: 66, lineHeight: 0.9, color: "#f6efe9" }}>
        <span>NUOVA</span>
        <span style={{ color: "#19d35e" }}>APP</span>
      </div>
      <div style={{ position: "absolute", left: 908, top: 1190, display: "flex", flexDirection: "column", alignItems: "flex-start", fontFamily: "Bebas", fontSize: 38, lineHeight: 0.95, color: "#f2a20c" }}>
        <span>#BOLO</span>
        <span>SGREENERS</span>
      </div>
    </div>,
    { width: W, height: H, fonts: a.fonts },
  );
  writeFileSync(join(process.cwd(), "data/private/video/lavoro/post-sfondo-video.png"), Buffer.from(await r.arrayBuffer()));
  console.log("ok");
})();
