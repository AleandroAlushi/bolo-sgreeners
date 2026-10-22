import { ImageResponse } from "next/og";
import { getMatchDetail } from "@/lib/data/matches";
import { C, FONTS, Frame, SIZES, TeamMark, formatFrom, longDate } from "@/lib/graphics/theme";

/** Grafica "Final Score" (o "Next Game") di una partita: /grafiche/partita/<id>?formato=post|storia */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/partita/[id]">) {
  const { id } = await ctx.params;
  const detail = await getMatchDetail(id);
  if (!detail) return new Response("Partita non trovata", { status: 404 });
  const m = detail.match;
  const format = formatFrom(req.url);
  const played = (m.status === "played" || m.status === "forfeit") && m.home_score !== null;
  const homeWin = played && m.home_score! > m.away_score!;
  const sides = [
    { name: m.home_team_name ?? "", own: !!m.home_is_own, score: m.home_score, win: homeWin },
    { name: m.away_team_name ?? "", own: !!m.away_is_own, score: m.away_score, win: played && !homeWin },
  ];
  const label = [m.competition_name, m.round_label ?? (m.round_number ? `${m.round_number}ª giornata` : null)].filter(Boolean).join(" · ");
  const big = format === "storia" ? 300 : 250;
  return new ImageResponse(
    (
      <Frame label={label}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontSize: 128, color: C.yellow, lineHeight: 1 }}>
            {played ? "Final Score" : "Next Game"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48, gap: 12 }}>
            {sides.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 32, opacity: played && !s.win ? 0.5 : 1 }}>
                <TeamMark name={s.name} own={s.own} size={130} />
                <div style={{ display: "flex", flex: 1, fontSize: 46, fontWeight: 600, color: s.own ? C.green : C.text, lineHeight: 1.1 }}>{s.name}</div>
                {played && <div style={{ display: "flex", fontFamily: "Bebas", fontSize: big, lineHeight: 0.85 }}>{s.score}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 34, color: C.muted, gap: 8 }}>
            <span style={{ display: "flex" }}>
              {longDate(m.match_date)}
              {!played && m.start_time ? ` · ore ${m.start_time.slice(0, 5)}` : ""}
            </span>
            {m.venue_name && <span style={{ display: "flex" }}>{m.venue_name}</span>}
          </div>
        </div>
      </Frame>
    ),
    { ...SIZES[format], fonts: FONTS, headers: { "Cache-Control": "public, max-age=600" } },
  );
}
