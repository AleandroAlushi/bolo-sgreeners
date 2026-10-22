import { ImageResponse } from "next/og";
import { getMatchDetail } from "@/lib/data/matches";
import { C, FONTS, Frame, SIZES, formatFrom, longDate } from "@/lib/graphics/theme";

/** Grafica MVP della partita: /grafiche/mvp/<id partita>?formato=post|storia */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/mvp/[id]">) {
  const { id } = await ctx.params;
  const detail = await getMatchDetail(id);
  const line = detail?.playerLines.find((l) => l.player_id === detail.mvpPlayerId);
  if (!detail || !line) return new Response("MVP non indicato per questa partita", { status: 404 });
  const m = detail.match;
  const format = formatFrom(req.url);
  const [first, ...rest] = (line.player_name ?? "").split(" ");
  const stats = [
    line.points !== null && `${line.points} Pts`,
    line.reb !== null && line.reb > 0 && `${line.reb} Reb`,
    line.ast !== null && line.ast > 0 && `${line.ast} Ast`,
    line.stl !== null && line.stl > 0 && `${line.stl} Stl`,
    line.blk !== null && line.blk > 0 && `${line.blk} Blk`,
    line.fg3m !== null && line.fg3m > 1 && `${line.fg3m} 3PM`,
  ].filter((s): s is string => Boolean(s)).slice(0, 5);
  return new ImageResponse(
    (
      <Frame label={`vs ${m.opponent_name ?? ""} · ${m.own_score ?? "–"}-${m.opponent_score ?? "–"}`}>
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1, paddingBottom: 40 }}>
            <div style={{ display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontSize: format === "storia" ? 300 : 250, color: C.gold, lineHeight: 0.9 }}>MVP</div>
            <div style={{ display: "flex", fontSize: 40, color: C.muted, letterSpacing: 8, textTransform: "uppercase", marginTop: 12 }}>{first}</div>
            <div style={{ display: "flex", fontFamily: "Bebas", fontSize: 170, lineHeight: 0.85 }}>{rest.join(" ")}</div>
            <div style={{ display: "flex", fontFamily: "Bebas", fontSize: 90, color: C.green, lineHeight: 1 }}>#{line.jersey_number}</div>
            <div style={{ display: "flex", fontSize: 32, color: C.muted, marginTop: 16 }}>{longDate(m.match_date)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, paddingLeft: 40, borderLeft: `3px solid ${C.amber}` }}>
            {stats.map((s) => (
              <div key={s} style={{ display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontSize: 96, lineHeight: 1 }}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </Frame>
    ),
    { ...SIZES[format], fonts: FONTS, headers: { "Cache-Control": "public, max-age=600" } },
  );
}
