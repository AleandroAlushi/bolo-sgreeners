import "server-only";
/**
 * Modelli delle grafiche Instagram (post 1080×1350, storia 1080×1920). Ogni modello riceve i
 * dati già letti dal database e restituisce l'albero da passare a ImageResponse.
 */
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import type { PlayerGameLine } from "@/lib/data/matches";
import type { GraphicMatch, MonthMatch } from "./data";
import { Accent, BigTitle, C, Canvas, FONTS, MatchBox, SIZES, SideLegend, TeamMark, clock, dayMonth, dayShort, longDate, monthName, sideColor, type GraphicFormat, type GraphicOptions } from "./theme";

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

export const isPlayed = (g: GraphicMatch) => (g.match.status === "played" || g.match.status === "forfeit") && g.match.home_score !== null;

function SidePill({ home }: { home: boolean | null }) {
  if (home === null) return null;
  return (
    <div style={{ display: "flex", alignSelf: "flex-start", padding: "8px 22px", border: `4px solid ${sideColor(home)}`, color: sideColor(home), fontSize: 30, fontWeight: 600, letterSpacing: 4 }}>
      {home ? "IN CASA" : "IN TRASFERTA"}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Final Score
// ---------------------------------------------------------------------------
export function FinalScore({ g, opts }: { g: GraphicMatch; opts: GraphicOptions }) {
  const m = g.match;
  const homeWin = (m.home_score ?? 0) > (m.away_score ?? 0);
  const sides = [
    { name: m.home_team_name ?? "", own: !!m.home_is_own, score: m.home_score, win: homeWin, logo: m.home_is_own ? null : g.opponentLogo },
    { name: m.away_team_name ?? "", own: !!m.away_is_own, score: m.away_score, win: !homeWin, logo: m.away_is_own ? null : g.opponentLogo },
  ];
  const big = opts.format === "storia" ? 260 : 220;
  return (
    <Canvas format={opts.format} photo={opts.photo} label={competitionLabel(g)}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
        <BigTitle size={opts.format === "storia" ? 240 : 210}>{opts.title ?? "FINAL"}</BigTitle>
        {!opts.title && <Accent size={110} color={C.yellow}>Score</Accent>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 50 }}>
        {sides.map((s) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 30, opacity: s.win ? 1 : 0.55 }}>
            <TeamMark name={s.name} own={s.own} logoUrl={s.logo} size={124} />
            <div style={{ display: "flex", flex: 1, fontSize: 44, fontWeight: 600, lineHeight: 1.1, color: s.own ? C.green : C.text }}>{s.name}</div>
            <div style={{ display: "flex", fontFamily: "Bebas", fontSize: big, lineHeight: 0.82 }}>{s.score}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", fontSize: 32, color: C.muted, marginBottom: 28 }}>
        <span>{longDate(m.match_date)}</span>
        {m.venue_name && <span>{m.venue_name}</span>}
      </div>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// Game day: presentazione della partita
// ---------------------------------------------------------------------------
export function GameDay({ g, opts }: { g: GraphicMatch; opts: GraphicOptions }) {
  const m = g.match;
  const story = opts.format === "storia";
  return (
    <Canvas format={opts.format} photo={opts.photo} label={competitionLabel(g)}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 80 : 36 }}>
        <BigTitle size={story ? 270 : 230}>{opts.title ?? "GAME DAY"}</BigTitle>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6 }}>
          <Accent size={70} color={C.yellow}>vs</Accent>
          <div style={{ display: "flex", fontSize: 50, fontWeight: 600, maxWidth: 860 }}>{m.opponent_name ?? "Avversario da definire"}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: story ? 90 : 50 }}>
        <div style={{ display: "flex" }}>
          <MatchBox name={m.opponent_name ?? "?"} logoUrl={g.opponentLogo} home={g.home} date={m.match_date} time={m.start_time} scale={story ? 1.3 : 1.15} />
        </div>
        <SidePill home={g.home} />
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", fontSize: 34, color: C.muted, marginBottom: 28, gap: 4 }}>
        {venueLine(g).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </Canvas>
  );
}

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
// Tabellino: risultato, migliori e numeri di squadra (dal box score importato)
// ---------------------------------------------------------------------------
const lastName = (l: PlayerGameLine) => (l.player_name ?? l.raw_name ?? "").split(" ").slice(1).join(" ") || l.player_name || l.raw_name || "";
const pct = (m: number | null, a: number | null) => (m !== null && a ? `${Math.round((m / a) * 100)}%` : "–");

export function BoxScore({ g, opts }: { g: GraphicMatch; opts: GraphicOptions }) {
  const m = g.match;
  const story = opts.format === "storia";
  const own = g.playerLines.filter((l) => l.is_own_team && l.participation === "played");
  const leader = (k: "points" | "reb" | "ast") => [...own].filter((l) => (l[k] ?? 0) > 0).sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0))[0] ?? null;
  const leaders = [
    { label: "PUNTI", key: "points" as const },
    { label: "RIMBALZI", key: "reb" as const },
    { label: "ASSIST", key: "ast" as const },
  ].map((x) => ({ ...x, line: leader(x.key) }));
  const ownTeamId = m.home_is_own ? m.home_team_id : m.away_team_id;
  const team = g.teamStats.find((t) => t.team_id === ownTeamId);
  const scorers = [...own].filter((l) => (l.points ?? 0) > 0).sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, story ? 8 : 5);
  const result = m.own_result === "W" ? "VITTORIA" : m.own_result === "L" ? "SCONFITTA" : "FINALE";
  return (
    <Canvas format={opts.format} photo={story ? opts.photo : null} label={competitionLabel(g)}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
        <Accent size={64} color={C.yellow}>{opts.title ?? "Final Score"}</Accent>
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 10 }}>
          <BigTitle size={story ? 230 : 200} color={m.own_result === "W" ? C.green : C.text}>
            {`${m.own_score ?? "–"}-${m.opponent_score ?? "–"}`}
          </BigTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: 4, color: m.own_result === "W" ? C.green : C.muted }}>{result}</span>
            <span style={{ fontSize: 34, maxWidth: 520 }}>vs {m.opponent_name}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 40 }}>
        {leaders.map((x) => (
          <div key={x.label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 24px", border: `5px solid ${C.lime}`, backgroundColor: "rgba(10,11,10,0.5)" }}>
            <span style={{ fontSize: 24, letterSpacing: 4, color: C.muted }}>{x.label}</span>
            <span style={{ fontFamily: "Bebas", fontSize: 120, lineHeight: 0.95 }}>{x.line ? x.line[x.key] : "–"}</span>
            <span style={{ fontSize: 30, fontWeight: 600 }}>{x.line ? lastName(x.line) : ""}</span>
          </div>
        ))}
      </div>
      {team && (
        <div style={{ display: "flex", gap: 36, marginTop: 30, fontSize: 30 }}>
          {[
            { label: "Dal campo", v: `${team.fgm ?? "–"}/${team.fga ?? "–"}`, p: pct(team.fgm, team.fga) },
            { label: "Da tre", v: `${team.fg3m ?? "–"}/${team.fg3a ?? "–"}`, p: pct(team.fg3m, team.fg3a) },
            { label: "Liberi", v: `${team.ftm ?? "–"}/${team.fta ?? "–"}`, p: pct(team.ftm, team.fta) },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: C.muted, fontSize: 24, letterSpacing: 3, textTransform: "uppercase" }}>{s.label}</span>
              <span style={{ fontWeight: 600 }}>
                {s.v} · {s.p}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 34, gap: 6 }}>
        <span style={{ fontSize: 24, letterSpacing: 4, color: C.muted }}>MARCATORI</span>
        {scorers.map((l) => (
          <div key={l.id ?? l.raw_name ?? ""} style={{ display: "flex", alignItems: "baseline", gap: 18, fontSize: 36 }}>
            <span style={{ fontFamily: "Bebas", fontSize: 44, width: 70, color: C.green }}>{l.points}</span>
            <span>{l.player_name ?? l.raw_name}</span>
            {l.jersey_number && <span style={{ color: C.muted, fontSize: 28 }}>#{l.jersey_number}</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", fontSize: 28, color: C.muted, marginBottom: 24 }}>{longDate(m.match_date)}</div>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// MVP
// ---------------------------------------------------------------------------
export function Mvp({ g, line, opts }: { g: GraphicMatch; line: PlayerGameLine; opts: GraphicOptions }) {
  const m = g.match;
  const [first, ...rest] = (line.player_name ?? "").split(" ");
  const stats = [
    line.points !== null && `${line.points} Pts`,
    line.reb !== null && line.reb > 0 && `${line.reb} Reb`,
    line.ast !== null && line.ast > 0 && `${line.ast} Ast`,
    line.stl !== null && line.stl > 0 && `${line.stl} Stl`,
    line.blk !== null && line.blk > 0 && `${line.blk} Blk`,
    line.fg3m !== null && line.fg3m > 1 && `${line.fg3m} 3PM`,
  ]
    .filter((s): s is string => Boolean(s))
    .slice(0, 5);
  return (
    <Canvas format={opts.format} photo={opts.photo} photoSide="right" label={`vs ${m.opponent_name ?? ""} · ${m.own_score ?? "–"}-${m.opponent_score ?? "–"}`}>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1, paddingBottom: 40 }}>
          <Accent size={opts.format === "storia" ? 300 : 250} color={C.gold}>
            {opts.title ?? "MVP"}
          </Accent>
          <div style={{ display: "flex", fontSize: 40, color: C.muted, letterSpacing: 8, textTransform: "uppercase", marginTop: 12 }}>{first}</div>
          <BigTitle size={170}>{rest.join(" ")}</BigTitle>
          <div style={{ display: "flex", fontFamily: "Bebas", fontSize: 90, color: C.green, lineHeight: 1 }}>#{line.jersey_number}</div>
          <div style={{ display: "flex", fontSize: 32, color: C.muted, marginTop: 16 }}>{longDate(m.match_date)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, paddingLeft: 40, borderLeft: `4px solid ${C.lime}` }}>
          {stats.map((s) => (
            <Accent key={s} size={92}>
              {s}
            </Accent>
          ))}
        </div>
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
