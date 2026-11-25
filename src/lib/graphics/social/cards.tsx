/**
 * Grafiche Instagram in stile Canva (dalla stagione 2026-27): presentazione della partita (post e
 * storia), finale, MVP, box score e leader della partita. Lo sfondo è una base già pronta
 * (assets/grafiche/*.jpg); qui sopra vanno solo scritte e foto, nelle posizioni delle grafiche
 * di riferimento (post 1080×1350, storia 1080×1920). I dati arrivano da ./model.ts.
 */
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";
import { socialAssets, type SocialAssets } from "./assets";
import { fitSize, INK, inkWidth, measure, Pic, Squeezed, Stretch, T } from "./layout";
import type { PlacedImage } from "./photo";

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
  /** la nostra squadra (il suo logo è già nella base) */
  own?: boolean;
  name: string;
  /** logo come URL o data URI; null = sigla in un cerchio */
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
  /** giocatori già colorati e posizionati (solo nel post): il primo in primo piano, il secondo dietro */
  players?: PlacedImage[];
}

export interface FinalData {
  /** in alto sempre gli Sgreeners (il loro logo è nella base) */
  own: TeamBadge & { score: number };
  opponent: TeamBadge & { score: number };
}

export interface MvpData {
  name: string;
  /** "16 PTS", "9 REB", "3 STL", "50% FG" (al massimo 4) */
  stats: string[];
  /** scontorno già sfumato in basso; `full`: foto in partita a figura intera */
  photo: { src: string; w: number; h: number; full: boolean } | null;
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
  firstName: string;
  lastName: string;
  /** mezzo busto già ridotto alla scala comune */
  photo: { src: string; w: number; h: number } | null;
}

const Frame = ({ base, width, height, children }: { base: string; width: number; height: number; children?: ReactNode }) => (
  <div style={{ display: "flex", width, height, position: "relative", overflow: "hidden", color: INK, backgroundColor: "#0b0b0b" }}>
    <Pic src={base} x={0} y={0} w={width} h={height} />
    {children}
  </div>
);

/** Divide il nome della palestra su due righe il più possibile pari ("PALESTRA" / "CERVELLATI"). */
function splitVenue(venue: string): string[] {
  const words = venue.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words;
  let best = 1;
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const w = Math.max(measure(words.slice(0, i).join(" "), "Barlow", 60), measure(words.slice(i).join(" "), "Barlow", 60));
    if (w < bestW) [best, bestW] = [i, w];
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

// ---------------------------------------------------------------------------
// Presentazione della partita (mattina della gara)
// ---------------------------------------------------------------------------
export function PreMatchCard({ d, format, a }: { d: PreMatchData; format: SocialFormat; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES[format];
  const story = format === "storia";
  const L = story
    ? { own: [62, 520, 470, 860], opp: [62, 1025, 470, 1365], vs: 943, info: 1480, gap: 84 }
    : { own: [62, 245, 470, 615], opp: [62, 705, 470, 1065], vs: 658, info: 1185, gap: 78 };
  // nella storia, come nell'esempio: orario senza "ORE" e palestra su due righe
  const lines = story
    ? [d.day, d.time ?? "", ...(d.venue ? splitVenue(d.venue) : [])].filter(Boolean)
    : [d.day, d.time ? `ORE ${d.time}` : ""].filter(Boolean);
  const players = story ? [] : [...(d.players ?? [])].reverse(); // prima quello dietro
  return (
    <Frame base={a.bases[story ? "presentazione-storia" : "presentazione-post"]} width={width} height={height}>
      {players.map((p, i) => (
        <Pic key={i} src={p.src} x={p.x} y={p.y} w={p.w} h={p.h} />
      ))}
      <Stretch text={d.own.code} box={L.own as [number, number, number, number]} />
      <Stretch text={d.opponent.code} box={L.opp as [number, number, number, number]} />
      <T x={203} y={L.vs + 19} size={54} align="c">
        {d.away ? "AT" : "VS"}
      </T>
      {lines.map((l, i) => (
        <T key={l + i} x={52} y={L.info + i * L.gap} size={fitSize(l, "Barlow", 60, 415)}>
          {l}
        </T>
      ))}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Finale
// ---------------------------------------------------------------------------
export function FinalCard({ d, a }: { d: FinalData; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const logo = 190;
  return (
    <Frame base={a.bases.finale} width={width} height={height}>
      <Stretch text="FINALE" box={[285, 210, 875, 520]} />
      <T x={682} y={725} size={172} font="BarlowSemi" align="r">
        {String(d.own.score)}
      </T>
      <T x={682} y={945} size={172} font="BarlowSemi" align="r">
        {String(d.opponent.score)}
      </T>
      {/* logo dell'avversario nel cerchio (i loghi del Livescore hanno il quadrato attorno) */}
      <div style={{ display: "flex", position: "absolute", left: 810 - logo / 2, top: 888 - logo / 2, width: logo, height: logo, borderRadius: logo, overflow: "hidden", alignItems: "center", justifyContent: "center", border: d.opponent.logo ? "none" : `5px solid ${INK}` }}>
        {d.opponent.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse
          <img src={d.opponent.logo} alt="" width={logo / 0.88} height={logo / 0.88} style={{ width: logo / 0.88, height: logo / 0.88, objectFit: "contain" }} />
        ) : (
          <div style={{ display: "flex", fontFamily: "Bebas", fontSize: logo * 0.42 }}>{d.opponent.code}</div>
        )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// MVP
// ---------------------------------------------------------------------------
export function MvpCard({ d, a }: { d: MvpData; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const p = d.photo;
  return (
    <Frame base={a.bases.mvp} width={width} height={height}>
      <Stretch text="MVP" box={[497, 115, 815, 368]} />
      {p && <Pic src={p.src} x={Math.round(545 - p.w / 2)} y={(p.full ? 1300 : 1350) - p.h} w={p.w} h={p.h} />}
      {d.stats.slice(0, 4).map((s, i) => (
        <T key={s} x={1000} y={550 + i * 100} size={78} align="r">
          {s}
        </T>
      ))}
      <T x={995} y={985} size={fitSize(d.name, "Playfair", 64, 640)} font="Playfair" align="r">
        {d.name}
      </T>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------
export function BoxScoreCard({ rows, a }: { rows: BoxRow[]; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const cols = [520, 670, 822, 970];
  const step = Math.min(87.5, 980 / Math.max(rows.length, 1));
  const nameSize = Math.round(Math.min(70, step * 0.8));
  const numSize = Math.round(Math.min(64, step * 0.73));
  return (
    <Frame base={a.bases["box-score"]} width={width} height={height}>
      <Stretch text="BOX SCORE" box={[32, 140, 430, 265]} />
      {["PTS", "REB", "AST", "STL"].map((h, i) => (
        <T key={h} x={cols[i]} y={262} size={64} align="c">
          {h}
        </T>
      ))}
      {rows.map((r, i) => {
        const y = Math.round(352 + i * step);
        return (
          <div key={r.name + i} style={{ display: "flex" }}>
            <T x={415} y={y} size={fitSize(r.name, "Playfair", nameSize, 395)} font="Playfair" align="r">
              {r.name}
            </T>
            {[r.pts, r.reb, r.ast, r.stl].map((v, j) =>
              v ? (
                <T key={j} x={cols[j]} y={y} size={numSize} align="c">
                  {String(v)}
                </T>
              ) : null,
            )}
          </div>
        );
      })}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Leader della partita
// ---------------------------------------------------------------------------
export function LeadersCard({ leaders, a }: { leaders: Leader[]; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  const band = [632, 1066];
  const xs = [140, 400, 660, 912];
  return (
    <Frame base={a.bases.leader} width={width} height={height}>
      <Stretch text="LEADER DELLA PARTITA" box={[42, 65, 855, 190]} />
      {leaders.slice(0, 4).map((l, i) => {
        const x = xs[i];
        const p = l.photo;
        const h = p ? Math.min(p.h, band[1] - band[0]) : 0;
        return (
          <div key={l.label} style={{ display: "flex" }}>
            {p && (
              // mezzo busto appoggiato in fondo alla fascia (tagliato in alto se fosse più alto)
              <div style={{ display: "flex", position: "absolute", left: Math.round(x - p.w / 2), top: band[1] - h, width: p.w, height: h, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
                <img src={p.src} alt="" width={p.w} height={p.h} style={{ position: "absolute", left: 0, top: h - p.h, width: p.w, height: p.h }} />
              </div>
            )}
            <T x={x} y={540} size={fitSize(l.firstName, "Playfair", 58, 245, 40)} font="Playfair" align="c">
              {l.firstName}
            </T>
            <T x={x} y={622} size={fitSize(l.lastName, "Playfair", 58, 245, 40)} font="Playfair" align="c">
              {l.lastName}
            </T>
            <Squeezed text={l.label} x={x} y={965} cap={95} squeeze={0.55} />
            <T x={x} y={1165} size={84} align="c">
              {String(l.value)}
            </T>
          </div>
        );
      })}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Andamento della partita (dalla diretta): come il grafico della pagina live
// ---------------------------------------------------------------------------
export interface FlowCardData {
  own: { code: string; score: number };
  opponent: { code: string; score: number };
  points: { x: number; own: number; opp: number }[];
  maxX: number;
  periodEnds: { x: number; label: string }[];
  lastLabel: string;
}

const OWN_LINE = "#4be38a";
const OPP_LINE = "#f4a63c";

export function FlowCard({ d, a }: { d: FlowCardData; a: SocialAssets }) {
  const { width, height } = SOCIAL_SIZES.post;
  // stesso titolo del Leader: stessa altezza e stessa strettezza delle lettere
  const cap = 125;
  const squeeze = 813 / inkWidth("LEADER DELLA PARTITA", "Bebas", cap / 0.7);
  const area = { l: 120, r: 1010, t: 440, b: 1110 };
  const top = Math.max(10, ...d.points.map((p) => Math.max(p.own, p.opp)));
  const step = top > 80 ? 25 : top > 40 ? 20 : 10;
  const maxY = Math.ceil(top / step) * step;
  const x = (v: number) => area.l + (v / d.maxX) * (area.r - area.l);
  const y = (v: number) => area.b - (v / maxY) * (area.b - area.t);
  const path = (k: "own" | "opp") => d.points.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: maxY / step }, (_, i) => (i + 1) * step);
  // etichette dei periodi al centro di ogni tratto
  const bounds = [0, ...d.periodEnds.map((p) => p.x), d.maxX];
  const labels = d.periodEnds.length ? [...d.periodEnds.map((p) => p.label), d.lastLabel] : [];
  // massimo vantaggio nostro
  const best = d.points.reduce((m, p) => (p.own - p.opp > m.lead ? { lead: p.own - p.opp, x: p.x } : m), { lead: 0, x: 0 });
  const bestPeriod = labels.length ? labels[Math.max(0, bounds.findIndex((b, i) => i > 0 && best.x <= b) - 1)] : null;
  const last = d.points[d.points.length - 1];
  const legend = [
    { color: OWN_LINE, text: `${d.own.code} ${d.own.score}` },
    { color: OPP_LINE, text: `${d.opponent.code} ${d.opponent.score}` },
  ];
  return (
    <Frame base={a.bases.andamento} width={width} height={height}>
      <Squeezed text="ANDAMENTO" x={42} y={65} cap={cap} squeeze={squeeze} align="l" />
      {legend.map((l, i) => (
        <div key={l.text} style={{ display: "flex" }}>
          <div style={{ display: "flex", position: "absolute", left: 48 + i * 300, top: 300, width: 30, height: 30, borderRadius: 30, backgroundColor: l.color }} />
          <T x={92 + i * 300} y={328} size={60}>
            {l.text}
          </T>
        </div>
      ))}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {ticks.map((v) => (
          <line key={v} x1={area.l} x2={area.r} y1={y(v)} y2={y(v)} stroke="rgba(246,242,236,0.22)" strokeWidth={2} strokeDasharray="6 10" />
        ))}
        <line x1={area.l} x2={area.r} y1={area.b} y2={area.b} stroke="rgba(246,242,236,0.45)" strokeWidth={2} />
        {d.periodEnds.map((p) => (
          <line key={p.x} x1={x(p.x)} x2={x(p.x)} y1={area.t - 10} y2={area.b} stroke="rgba(246,242,236,0.3)" strokeWidth={2} />
        ))}
        <path d={path("opp")} fill="none" stroke={OPP_LINE} strokeOpacity={0.22} strokeWidth={24} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path("own")} fill="none" stroke={OWN_LINE} strokeOpacity={0.22} strokeWidth={24} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path("opp")} fill="none" stroke={OPP_LINE} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path("own")} fill="none" stroke={OWN_LINE} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last.x)} cy={y(last.opp)} r={13} fill={OPP_LINE} />
        <circle cx={x(last.x)} cy={y(last.own)} r={13} fill={OWN_LINE} />
      </svg>
      {ticks.map((v) => (
        <T key={v} x={area.l - 18} y={y(v) + 11} size={32} align="r" color="rgba(246,242,236,0.7)">
          {String(v)}
        </T>
      ))}
      {labels.map((l, i) => (
        <T key={l + i} x={(x(bounds[i]) + x(bounds[i + 1])) / 2} y={area.b + 58} size={40} align="c" color="rgba(246,242,236,0.8)">
          {l}
        </T>
      ))}
      {best.lead > 0 && (
        <T x={48} y={1235} size={48}>
          {`Massimo vantaggio +${best.lead}${bestPeriod ? ` (${bestPeriod})` : ""}`}
        </T>
      )}
    </Frame>
  );
}
