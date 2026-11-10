import "server-only";
/**
 * Modelli delle grafiche Instagram (post 1080×1350, storia 1080×1920). Ogni modello riceve i
 * dati già letti dal database e restituisce l'albero da passare a ImageResponse.
 */
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import type { GraphicMatch, MonthMatch } from "./data";
import { Accent, BigTitle, C, Canvas, FONTS, MatchBox, SIZES, SideLegend, clock, dayMonth, dayShort, monthName, sideColor, type GraphicFormat, type GraphicOptions } from "./theme";

export function render(el: ReactElement, format: GraphicFormat) {
  return new ImageResponse(el, { ...SIZES[format], fonts: FONTS, headers: { "Cache-Control": "private, max-age=600" } });
}

const competitionLabel = (g: GraphicMatch) =>
  [g.match.competition_name, g.match.round_label ?? (g.match.round_number ? `${g.match.round_number}ª giornata` : null)].filter(Boolean).join(" · ");

/** Palestra e indirizzo (la città solo se l'indirizzo non la contiene già). */
const venueLine = (g: GraphicMatch) => {
  const { venue_name: name, venue_address: address, venue_city: city } = g.match;
  const where = address && city && address.toLowerCase().includes(city.toLowerCase()) ? address : [address, city].filter(Boolean).join(", ");
  return [name, where].filter((x): x is string => Boolean(x));
};

// ---------------------------------------------------------------------------
// Chiamata a raccolta dei tifosi (pensata per le storie)
// ---------------------------------------------------------------------------
export function FansCall({ g, opts }: { g: GraphicMatch; opts: GraphicOptions }) {
  const m = g.match;
  const story = opts.format === "storia";
  const lines = opts.title ? [opts.title] : g.home === false ? ["SI VA IN", "TRASFERTA"] : ["TUTTI AL", "PALAZZETTO"];
  return (
    <Canvas format={opts.format} photo={opts.photo} label={competitionLabel(g)} panel>
      <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 110 : 40 }}>
        {lines.map((l) => (
          <BigTitle key={l} size={story ? 240 : 196}>
            {l}
          </BigTitle>
        ))}
        <div style={{ display: "flex", marginTop: 14 }}>
          <Accent size={story ? 84 : 70}>{g.home === false ? "venite a sostenerci" : "vi aspettiamo"}</Accent>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 110 : 56, gap: 6 }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: C.muted }}>Bolo Sgreeners vs {m.opponent_name ?? "?"}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 26, fontFamily: "Bebas", fontSize: story ? 200 : 170, lineHeight: 0.95 }}>
          <span>{dayShort(m.match_date)}</span>
          <span>{dayMonth(m.match_date)}</span>
        </div>
        <div style={{ display: "flex", fontFamily: "Bebas", fontSize: story ? 150 : 120, lineHeight: 0.95, color: sideColor(g.home) }}>ORE {clock(m.start_time)}</div>
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", fontSize: 36, marginBottom: 28, gap: 4 }}>
        {venueLine(g).map((l, i) => (
          <span key={l} style={{ color: i === 0 ? C.text : C.muted, fontWeight: i === 0 ? 600 : 400 }}>
            {l}
          </span>
        ))}
      </div>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// Calendario del mese
// ---------------------------------------------------------------------------
export function MonthCalendar({ month, matches, opts }: { month: string; matches: MonthMatch[]; opts: GraphicOptions }) {
  const story = opts.format === "storia";
  const twoCols = matches.length > (story ? 4 : 3);
  const scale = twoCols ? (story ? 0.82 : 0.7) : story ? 1.1 : 0.95;
  return (
    <Canvas format={opts.format} photo={opts.photo} panel={twoCols}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
        <BigTitle size={story ? 230 : 200}>{opts.title ?? monthName(`${month}-01`)}</BigTitle>
      </div>
      {matches.length === 0 ? (
        <div style={{ display: "flex", fontSize: 40, color: C.muted, marginTop: 40 }}>Nessuna partita in programma.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 30 }}>
          {matches.map((x) => (
            <div key={x.match.id ?? ""} style={{ display: "flex", width: twoCols ? 460 : 640 }}>
              <MatchBox name={x.match.opponent_name ?? "?"} logoUrl={x.opponentLogo} home={x.home} date={x.match.match_date} time={x.match.start_time} scale={scale} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", marginBottom: 30 }}>
        <SideLegend size={36} />
      </div>
    </Canvas>
  );
}
