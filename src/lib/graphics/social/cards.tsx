/**
 * Grafiche Instagram "nuove" (dalla stagione 2026-27): presentazione della partita (post e
 * storia), finale, MVP, box score e leader della partita. Ricevono dati semplici (vedi
 * ./model.ts) e restituiscono l'albero per ImageResponse.
 */
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { Arc, Ball, Box, Condensed, CourtTexture, DARK, Grain, HBar, Haze, INK, VBar } from "./parts";
import { socialAssets, type SocialAssets } from "./assets";

export const SOCIAL_SIZES = { post: { width: 1080, height: 1350 }, storia: { width: 1080, height: 1920 } } as const;
export type SocialFormat = keyof typeof SOCIAL_SIZES;

export async function renderSocial(build: (a: SocialAssets) => ReactElement, format: SocialFormat = "post") {
  const a = await socialAssets();
  return new ImageResponse(build(a), { ...SOCIAL_SIZES[format], fonts: a.fonts, headers: { "Cache-Control": "private, no-store" } });
}

// ---------------------------------------------------------------------------
// Dati
// ---------------------------------------------------------------------------
export interface TeamBadge {
  code: string;
  /** la nostra squadra: senza logo caricato si usa quello degli Sgreeners */
  own?: boolean;
  name: string;
  /** logo come URL o data URI; null = iniziali */
  logo: string | null;
}

export interface PreMatchData {
  own: TeamBadge;
  opponent: TeamBadge;
  /** Sgreeners in trasferta: "AT" al posto di "VS" */
  away: boolean;
  /** "LUN 2.11" */
  day: string;
  /** "22:15" */
  time: string | null;
  venue: string | null;
  photo: string | null;
}

export interface FinalData {
  /** in alto la squadra di casa */
  top: TeamBadge & { score: number };
  bottom: TeamBadge & { score: number };
}

export interface MvpData {
  name: string;
  /** "12 PTS", "4 REB"... (al massimo 4) */
  stats: string[];
  photo: string | null;
  /** foto scontornata (PNG trasparente): niente riquadro */
  cutout?: boolean;
}

export interface BoxRow {
  name: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
}

export interface Leader {
  label: string;
  value: number;
  name: string;
  photo: string | null;
  cutout?: boolean;
}

// ---------------------------------------------------------------------------
// Pezzi comuni
// ---------------------------------------------------------------------------
const GROTESK = "Barlow";

/** Corpo del testo perché `text` stia in `max` pixel (larghezza media di un carattere ≈ em × `em`). */
const fit = (text: string, max: number, base: number, em = 0.44) => Math.min(base, Math.floor(max / Math.max(1, text.length * em)));

function Logo({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse
    return <img src={src} alt="" style={{ maxWidth: size, maxHeight: size, objectFit: "contain" }} />;
  }
  const initials = name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size, border: `4px solid ${DARK}`, alignItems: "center", justifyContent: "center", fontFamily: "Bebas", fontSize: size * 0.46, color: DARK }}>
      {initials || "?"}
    </div>
  );
}

/** Barra sfumata in alto con i loghi nei riquadri chiari. */
function TopBar({ width, story, badges, a }: { width: number; story: boolean; badges: TeamBadge[]; a: SocialAssets }) {
  const barH = story ? 62 : 36;
  const boxW = story ? 126 : 125;
  const boxH = story ? 122 : 128;
  const x0 = story ? 79 : 75;
  return (
    <>
      <Box style={{ top: 0, left: 0, width, height: barH, backgroundImage: "linear-gradient(90deg, #1d8fd6 0%, #1fb7c8 35%, #2fd27a 70%, #45dc3c 100%)" }} />
      <Box style={{ top: barH - 6, left: 0, width, height: 6, backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 60%, rgba(255,255,255,0.45) 100%)" }} />
      {badges.map((b, i) => (
        <Box key={b.code + i} style={{ top: 0, left: x0 + i * (boxW + 14), width: boxW, height: boxH, backgroundColor: "#f4efe9", alignItems: "center", justifyContent: "center", padding: 12 }}>
          {b.own && !b.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse
            <img src={a.logo} alt="" style={{ maxWidth: boxW - 22, maxHeight: boxH - 22, objectFit: "contain" }} />
          ) : (
            <Logo src={b.logo} name={b.name} size={boxW - 22} />
          )}
        </Box>
      ))}
    </>
  );
}

/** Colonna destra sfumata arancio → verde → azzurro, con la foto (se c'è) tinta dai colori. */
function GradientColumn({ left, width, height, photo, innerTop }: { left: number; width: number; height: number; photo: string | null; innerTop: number }) {
  const stops = "#a6622f 0%, #7f6a2c 22%, #5fa03a 42%, #3dd35a 60%, #22c79a 80%, #2a92d6 100%";
  return (
    <Box style={{ left, top: 0, width, height, overflow: "hidden", backgroundImage: `linear-gradient(180deg, ${stops})` }}>
      {/* luce calda in alto a destra */}
      <Box style={{ top: 0, left: 0, width, height: height * 0.5, backgroundImage: "radial-gradient(ellipse at 90% 10%, rgba(214,130,70,0.55) 0%, rgba(0,0,0,0) 60%)" }} />
      {photo && (
        // foto già ritagliata e tinta (./photo.ts → tintedPhoto)
        // eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse
        <img src={photo} alt="" width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height }} />
      )}
      {/* colonna interna leggermente più luminosa */}
      <Box style={{ left: 32, top: innerTop, width: width - 132, height: height - innerTop, backgroundImage: "linear-gradient(180deg, rgba(120,255,140,0) 0%, rgba(120,255,160,0.1) 40%, rgba(80,200,255,0.12) 100%)" }} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Presentazione della partita (mattina del giorno della gara)
// ---------------------------------------------------------------------------
export function PreMatchCard({ d, format, a }: { d: PreMatchData; format: SocialFormat; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES[format];
  const story = format === "storia";
  const split = 478;
  // posizioni ricavate dalle grafiche di riferimento (post 1080×1350, storia 1080×1920)
  const L = story
    ? { top: 535, cap: 335, vs: 940, bottom: 985, cap2: 365, info: 1420, infoGap: 88, info3: 1595, ball: { cx: -30, cy: 700, r: 165 }, innerTop: 1105 }
    : { top: 245, cap: 370, vs: 658, bottom: 705, cap2: 360, info: 1138, infoGap: 78, info3: 0, ball: { cx: -35, cy: 420, r: 165 }, innerTop: 795 };
  const infoSize = story ? 64 : 60;
  const lines = [d.day, d.time, story ? d.venue?.toUpperCase() : null].filter((x): x is string => Boolean(x));
  return (
    <div style={{ display: "flex", width, height, position: "relative", backgroundColor: DARK, overflow: "hidden", color: INK, fontFamily: GROTESK }}>
      <CourtTexture width={split} height={height} />
      <GradientColumn left={split} width={width - split} height={height} photo={d.photo} innerTop={L.innerTop} />
      <Ball {...L.ball} />
      <Grain src={a.grain} width={width} height={height} opacity={0.45} />
      <Arc cx={story ? 760 : 760} cy={story ? 1060 : 760} r={story ? 900 : 760} opacity={0.75} />
      <Arc cx={story ? 1010 : 1000} cy={story ? 1300 : 1080} r={story ? 1150 : 1030} opacity={0.7} />
      <TopBar width={width} story={story} badges={[d.own, d.opponent]} a={a} />
      <Condensed text={d.own.code} cap={L.cap} left={62} top={L.top} squeeze={252 / L.cap} />
      <Condensed text={d.opponent.code} cap={L.cap2} left={62} top={L.bottom} squeeze={252 / L.cap2} />
      <Box style={{ left: 205 - 64, top: L.vs - 64, width: 128, height: 128, borderRadius: 64, backgroundColor: "#050505", border: `5px solid ${INK}`, alignItems: "center", justifyContent: "center", fontSize: 54, letterSpacing: -1 }}>
        {d.away ? "AT" : "VS"}
      </Box>
      {lines.map((l, i) => (
        <Box key={l + i} style={{ left: 52, top: L.info + i * L.infoGap - infoSize * 0.2, fontSize: infoSize, letterSpacing: -1, whiteSpace: "nowrap" }}>
          {l}
        </Box>
      ))}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Sfondo di "Finale" e "MVP": striscia chiara a sinistra, barre al neon, blocco arancio,
// sfumatura verso il bianco in basso.
// ---------------------------------------------------------------------------
const CREAM = "#f4f1ec";

function StageBackground({ width, height, a }: { width: number; height: number; a: SocialAssets }) {
  const left = 120;
  const floor = 880;
  return (
    <>
      <Box style={{ top: 0, left: 0, width, height, backgroundColor: CREAM }} />
      {/* bagliore sulla striscia chiara */}
      <VBar left={-70} width={260} height={floor - 120} stops="rgba(64,200,240,0.9) 0%, rgba(70,226,140,0.9) 30%, rgba(214,220,30,0.95) 55%, rgba(244,241,236,0) 85%" />
      {/* pannello scuro */}
      <CourtTexture left={left} top={0} width={width - left} height={floor + 40} seed={11} />
      {/* blocco arancio */}
      <Box style={{ left: 478, top: 0, width: 532, height: floor, backgroundImage: "linear-gradient(180deg, rgba(178,92,44,0.95) 0%, rgba(150,76,36,0.9) 45%, rgba(60,30,16,0.6) 75%, rgba(12,10,9,0) 100%)" }} />
      {/* barre al neon */}
      <VBar left={110} width={150} height={floor - 140} stops="rgba(40,200,230,0) 0%, rgba(40,200,230,0.95) 10%, rgba(60,230,150,0.95) 38%, rgba(200,214,24,0.95) 62%, rgba(12,10,9,0) 92%" />
      <VBar left={228} width={140} height={floor - 120} stops="rgba(50,120,230,0) 0%, rgba(50,120,230,0.95) 8%, rgba(40,200,230,0.95) 30%, rgba(60,230,150,0.95) 50%, rgba(200,214,24,0.85) 68%, rgba(12,10,9,0) 92%" />
      <VBar left={345} width={140} height={floor - 160} stops="rgba(50,120,230,0) 0%, rgba(60,130,235,0.95) 12%, rgba(40,200,230,0.9) 34%, rgba(60,230,150,0.9) 52%, rgba(12,10,9,0) 85%" />
      <VBar left={990} width={130} height={floor - 120} stops="rgba(40,190,230,0) 0%, rgba(40,190,230,0.95) 15%, rgba(60,220,120,0.95) 40%, rgba(12,10,9,0) 80%" />
      {/* pavimento: fascia nera e sfumatura verso il bianco */}
      <Box style={{ left, top: floor, width: width - left, height: 46, backgroundColor: "#050505" }} />
      <Box style={{ left, top: floor + 46, width: width - left, height: height - floor - 46 - 95, backgroundImage: `linear-gradient(180deg, #050505 0%, #4a4a4a 30%, #b9b7b3 65%, ${CREAM} 100%)` }} />
      <Grain src={a.grain} width={width} height={height} opacity={0.4} />
      <Arc cx={560} cy={830} r={820} opacity={0.75} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Finale
// ---------------------------------------------------------------------------
export function FinalCard({ d, a }: { d: FinalData; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const rows = [
    { t: d.top, y: 600, logoY: 645, logoSize: 180 },
    { t: d.bottom, y: 785, logoY: 838, logoSize: 160 },
  ];
  return (
    <div style={{ display: "flex", width, height, position: "relative", overflow: "hidden", color: INK, fontFamily: GROTESK }}>
      <StageBackground width={width} height={height} a={a} />
      <Condensed text="FINALE" cap={315} left={280} top={205} squeeze={0.68} />
      {rows.map(({ t, y, logoY, logoSize }) => (
        <div key={t.code + y} style={{ display: "flex" }}>
          <Box style={{ left: 270, width: 400, top: y, justifyContent: "flex-end", fontSize: 168, fontWeight: 600, letterSpacing: -6, lineHeight: 1 }}>{String(t.score)}</Box>
          <Box style={{ left: 775 - logoSize / 2, top: logoY - logoSize / 2, width: logoSize, height: logoSize, alignItems: "center", justifyContent: "center" }}>
            {t.logo || t.own ? (
              // eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse
              <img src={t.logo ?? a.logo} alt="" style={{ maxWidth: logoSize, maxHeight: logoSize, objectFit: "contain" }} />
            ) : (
              <div style={{ display: "flex", width: logoSize, height: logoSize, borderRadius: logoSize, border: `5px solid ${INK}`, alignItems: "center", justifyContent: "center", fontFamily: "Bebas", fontSize: logoSize * 0.42 }}>
                {t.code}
              </div>
            )}
          </Box>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MVP
// ---------------------------------------------------------------------------
export function MvpCard({ d, a }: { d: MvpData; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const photo = { left: 300, top: 440, width: 520, height: 910 };
  return (
    <div style={{ display: "flex", width, height, position: "relative", overflow: "hidden", color: INK, fontFamily: GROTESK }}>
      <StageBackground width={width} height={height} a={a} />
      <Box style={{ left: 120, top: 0, width: 160, height }}>
        <Ball cx={20} cy={440} r={95} />
      </Box>
      <Condensed text="MVP" cap={258} left={495} top={102} squeeze={0.7} />
      {d.photo && d.cutout && (
        <>
          {/* scontorno: il giocatore sta sullo sfondo e sfuma nel bianco in basso */}
          {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
          <img src={d.photo} alt="" width={600} height={910} style={{ position: "absolute", left: 260, top: 440, width: 600, height: 910 }} />
          <Box style={{ left: 120, top: 1000, width: width - 120, height: height - 1000, backgroundImage: `linear-gradient(180deg, rgba(244,241,236,0) 0%, rgba(244,241,236,0.6) 45%, ${CREAM} 85%)` }} />
        </>
      )}
      {d.photo && !d.cutout && (
        <Box style={{ ...photo, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
          <img src={d.photo} alt="" width={photo.width} height={photo.height} style={{ width: photo.width, height: photo.height }} />
          {/* bordi sfumati: la foto si fonde con lo sfondo */}
          <Box style={{ left: 0, top: 0, width: 90, height: photo.height, backgroundImage: "linear-gradient(90deg, rgba(20,14,11,0.9) 0%, rgba(20,14,11,0) 100%)" }} />
          <Box style={{ left: photo.width - 90, top: 0, width: 90, height: photo.height, backgroundImage: "linear-gradient(270deg, rgba(20,14,11,0.9) 0%, rgba(20,14,11,0) 100%)" }} />
          <Box style={{ left: 0, top: 0, width: photo.width, height: 90, backgroundImage: "linear-gradient(180deg, rgba(20,14,11,0.9) 0%, rgba(20,14,11,0) 100%)" }} />
          <Box style={{ left: 0, top: photo.height * 0.5, width: photo.width, height: photo.height * 0.5, backgroundImage: `linear-gradient(180deg, rgba(244,241,236,0) 0%, rgba(244,241,236,0.55) 55%, ${CREAM} 92%)` }} />
        </Box>
      )}
      <Box style={{ left: 480, width: 495, top: 455, flexDirection: "column", alignItems: "flex-end", fontSize: 92, lineHeight: 1.08, letterSpacing: -2 }}>
        {d.stats.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </Box>
      <Box style={{ left: 240, width: 800, top: 905, justifyContent: "flex-end", fontFamily: "Playfair", fontStyle: "italic", fontSize: fit(d.name, 780, 66), letterSpacing: -2, whiteSpace: "nowrap" }}>{d.name}</Box>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------
export function BoxScoreCard({ rows, a }: { rows: BoxRow[]; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const split = 448;
  const cols = [522, 672, 825, 972];
  const pitch = Math.min(87, Math.floor(1000 / Math.max(rows.length, 1)));
  const font = Math.round(Math.min(64, pitch * 0.76));
  const nameFont = Math.round(Math.min(72, pitch * 0.84));
  const first = 290;
  const glowTop = Math.max(first + pitch * Math.max(rows.length - 4, 0), 900);
  return (
    <div style={{ display: "flex", width, height, position: "relative", overflow: "hidden", color: INK, fontFamily: GROTESK, backgroundColor: "#0b0b0b" }}>
      <Box style={{ left: 0, top: 0, width: split, height, backgroundImage: "linear-gradient(180deg, #2a86d0 0%, #26b8c2 22%, #33c97e 42%, #3fbf4f 58%, #24702f 76%, #0f2a14 90%, #0b0b0b 100%)" }} />
      <Haze cx={720} cy={330} rx={520} ry={420} opacity={0.26} />
      <Haze cx={1000} cy={760} rx={300} ry={380} opacity={0.18} />
      {/* luci colorate in fondo, come nelle grafiche */}
      <HBar left={split - 60} top={glowTop} width={width - split + 60} height={150} stops="rgba(214,220,30,0) 0%, rgba(214,220,30,0.85) 20%, rgba(80,220,120,0.85) 55%, rgba(60,200,230,0.8) 85%, rgba(60,200,230,0.3) 100%" />
      <HBar left={split - 60} top={glowTop + 120} width={width - split + 60} height={140} stops="rgba(214,220,30,0) 0%, rgba(214,220,30,0.85) 15%, rgba(80,220,120,0.8) 45%, rgba(60,200,230,0.8) 80%, rgba(40,120,220,0.7) 100%" />
      <HBar left={split - 60} top={glowTop + 240} width={width - split + 60} height={130} stops="rgba(214,220,30,0) 0%, rgba(214,220,30,0.7) 20%, rgba(80,220,120,0.75) 45%, rgba(40,160,220,0.75) 75%, rgba(40,110,220,0.8) 100%" />
      {[glowTop + 95, glowTop + 210, glowTop + 330].map((y) => (
        <Box key={y} style={{ left: split, top: y, width: width - split, height: 7, backgroundColor: "rgba(8,8,8,0.85)" }} />
      ))}
      <Grain src={a.grain} width={width} height={height} opacity={0.55} />
      <Condensed text="BOX SCORE" cap={124} left={30} top={140} squeeze={0.69} />
      {["PTS", "REB", "AST", "STL"].map((h, i) => (
        <Box key={h} style={{ left: cols[i] - 80, width: 160, top: 196, justifyContent: "center", fontSize: 70, letterSpacing: -2 }}>
          {h}
        </Box>
      ))}
      {rows.map((r, i) => {
        const y = first + i * pitch;
        return (
          <div key={r.name + i} style={{ display: "flex" }}>
            <Box style={{ left: 0, width: 415, justifyContent: "flex-end", top: y - nameFont * 0.05 + (nameFont - fit(r.name, 400, nameFont)) * 0.6, fontFamily: "Playfair", fontStyle: "italic", fontSize: fit(r.name, 400, nameFont), letterSpacing: -2, whiteSpace: "nowrap" }}>{r.name}</Box>
            {[r.pts, r.reb, r.ast, r.stl].map((v, j) => (
              <Box key={j} style={{ left: cols[j] - 80, width: 160, top: y + (nameFont - font) * 0.35, justifyContent: "center", fontSize: font }}>
                {v ? String(v) : ""}
              </Box>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leader della partita
// ---------------------------------------------------------------------------
export function LeadersCard({ leaders, a }: { leaders: Leader[]; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const cells = [
    { x: 45, title: 480, value: 712, photo: 655, name: 838 },
    { x: 510, title: 480, value: 712, photo: 655, name: 838 },
    { x: 45, title: 940, value: 1092, photo: 1040, name: 1245 },
    { x: 510, title: 940, value: 1092, photo: 1040, name: 1245 },
  ];
  return (
    <div style={{ display: "flex", width, height, position: "relative", overflow: "hidden", color: INK, fontFamily: GROTESK, backgroundColor: "#0a0a0a" }}>
      <Haze cx={420} cy={300} rx={560} ry={330} opacity={0.3} />
      <Haze cx={760} cy={1150} rx={420} ry={260} opacity={0.2} />
      <VBar left={760} width={130} height={640} stops="rgba(40,190,230,0.95) 0%, rgba(60,226,150,0.95) 40%, rgba(214,220,30,0.95) 80%, rgba(10,10,10,0) 100%" />
      <VBar left={980} width={130} height={640} stops="rgba(50,120,230,0.95) 0%, rgba(40,190,230,0.95) 30%, rgba(60,226,150,0.95) 55%, rgba(214,220,30,0.95) 85%, rgba(10,10,10,0) 100%" />
      <Box style={{ left: 0, top: 632, width, height: 436, backgroundImage: "linear-gradient(90deg, #2a86d0 0%, #27b9b8 25%, #3cc86c 50%, rgba(60,200,108,0.55) 75%, rgba(40,40,40,0.4) 100%)" }} />
      <Grain src={a.grain} width={width} height={height} opacity={0.55} />
      <Arc cx={130} cy={1500} r={760} opacity={0.6} />
      <Condensed text="LEADER DELLA PARTITA" cap={116} left={45} top={76} squeeze={0.69} />
      {leaders.slice(0, 4).map((l, i) => {
        const c = cells[i];
        return (
          <div key={l.label} style={{ display: "flex" }}>
            <Condensed text={l.label} cap={118} left={c.x} top={c.title} squeeze={0.69} />
            {l.photo && l.cutout && (
              // eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse
              <img src={l.photo} alt="" width={210} height={240} style={{ position: "absolute", left: c.x + 85, top: c.photo - 12, width: 210, height: 240 }} />
            )}
            {l.photo && !l.cutout && (
              <Box style={{ left: c.x + 95, top: c.photo, width: 190, height: 228, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
                <img src={l.photo} alt="" width={190} height={228} style={{ width: 190, height: 228 }} />
                <Box style={{ left: 0, top: 150, width: 190, height: 78, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)" }} />
              </Box>
            )}
            <Box style={{ left: c.x - 4, top: c.value, fontSize: 134, letterSpacing: -6, lineHeight: 1 }}>{String(l.value)}</Box>
            <Box style={{ left: c.x + 12, top: c.name + (62 - fit(l.name, 430, 62)) * 0.6, fontFamily: "Playfair", fontStyle: "italic", fontSize: fit(l.name, 430, 62), letterSpacing: -2, whiteSpace: "nowrap" }}>{l.name}</Box>
          </div>
        );
      })}
    </div>
  );
}
