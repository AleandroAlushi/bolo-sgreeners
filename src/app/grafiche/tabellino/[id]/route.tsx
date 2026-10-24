import { getGraphicMatch } from "@/lib/graphics/data";
import { BoxScore, isPlayed, render } from "@/lib/graphics/templates";
import { optionsFrom } from "@/lib/graphics/theme";

/** Risultato con migliori e numeri di squadra dal box score: /grafiche/tabellino/<id>?formato=post|storia&foto=&titolo= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/tabellino/[id]">) {
  const { id } = await ctx.params;
  const g = await getGraphicMatch(id);
  if (!g) return new Response("Partita non trovata", { status: 404 });
  if (!isPlayed(g) || !g.playerLines.some((l) => l.is_own_team && l.participation === "played")) {
    return new Response("Statistiche della partita non ancora caricate (importa il box score)", { status: 404 });
  }
  const opts = optionsFrom(req.url);
  return render(<BoxScore g={g} opts={opts} />, opts.format);
}
