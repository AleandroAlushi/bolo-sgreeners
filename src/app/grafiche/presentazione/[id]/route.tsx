import { getGraphicMatch } from "@/lib/graphics/data";
import { GameDay, render } from "@/lib/graphics/templates";
import { optionsFrom } from "@/lib/graphics/theme";

/** Presentazione della partita ("Game day"): /grafiche/presentazione/<id>?formato=post|storia&foto=&titolo= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/presentazione/[id]">) {
  const { id } = await ctx.params;
  const g = await getGraphicMatch(id);
  if (!g) return new Response("Partita non trovata", { status: 404 });
  const opts = optionsFrom(req.url);
  return render(<GameDay g={g} opts={opts} />, opts.format);
}
