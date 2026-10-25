import { getGraphicMatch } from "@/lib/graphics/data";
import { FansCall, render } from "@/lib/graphics/templates";
import { adminOnly } from "@/lib/graphics/access";
import { optionsFrom } from "@/lib/graphics/theme";

/** Chiamata a raccolta dei tifosi (di default storia): /grafiche/tifosi/<id>?formato=storia|post&foto=&titolo= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/tifosi/[id]">) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { id } = await ctx.params;
  const g = await getGraphicMatch(id);
  if (!g) return new Response("Partita non trovata", { status: 404 });
  const opts = optionsFrom(req.url, "storia");
  return render(<FansCall g={g} opts={opts} />, opts.format);
}
