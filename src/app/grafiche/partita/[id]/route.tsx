import { getGraphicMatch } from "@/lib/graphics/data";
import { FinalScore, GameDay, isPlayed, render } from "@/lib/graphics/templates";
import { optionsFrom } from "@/lib/graphics/theme";

/** "Final Score" a partita giocata, altrimenti "Game day": /grafiche/partita/<id>?formato=post|storia&foto=&titolo= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/partita/[id]">) {
  const { id } = await ctx.params;
  const g = await getGraphicMatch(id);
  if (!g) return new Response("Partita non trovata", { status: 404 });
  const opts = optionsFrom(req.url);
  return render(isPlayed(g) ? <FinalScore g={g} opts={opts} /> : <GameDay g={g} opts={opts} />, opts.format);
}
