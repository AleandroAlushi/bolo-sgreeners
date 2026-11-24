import { PreMatchCard, renderSocial } from "@/lib/graphics/social/cards";
import { socialAssets } from "@/lib/graphics/social/assets";
import { adminKit, preMatchPlayers, socialOptions } from "@/lib/graphics/social/route";

/** Presentazione della partita (mattina della gara): /grafiche/presentazione/<id>?formato=post|storia&foto=&foto2= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/presentazione/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  const { format, photo, photo2 } = socialOptions(req.url);
  // i giocatori solo nel post (la storia, come nell'esempio, è senza foto)
  const players = format === "post" ? await preMatchPlayers(photo, photo2, (await socialAssets()).baseFiles["presentazione-post"]) : [];
  return renderSocial((a) => <PreMatchCard d={{ ...kit.pre, players }} format={format} a={a} />, format);
}
