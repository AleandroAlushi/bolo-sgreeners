import { getGraphicMatch } from "@/lib/graphics/data";
import { Mvp, render } from "@/lib/graphics/templates";
import { optionsFrom } from "@/lib/graphics/theme";

/** Grafica MVP della partita: /grafiche/mvp/<id partita>?formato=post|storia&foto=&titolo= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/mvp/[id]">) {
  const { id } = await ctx.params;
  const g = await getGraphicMatch(id);
  const line = g?.playerLines.find((l) => l.player_id === g.mvpPlayerId);
  if (!g || !line) return new Response("MVP non indicato per questa partita", { status: 404 });
  const opts = optionsFrom(req.url);
  return render(<Mvp g={g} line={line} opts={opts} />, opts.format);
}
