import { FinalCard, PreMatchCard, renderSocial } from "@/lib/graphics/social/cards";
import { socialAssets } from "@/lib/graphics/social/assets";
import { adminKit, preMatchPlayers, socialOptions } from "@/lib/graphics/social/route";

/** "Finale" a partita giocata, altrimenti la presentazione: /grafiche/partita/<id>?formato=post|storia&foto=&foto2= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/partita/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (kit.final) {
    const final = kit.final;
    return renderSocial((a) => <FinalCard d={final} a={a} />);
  }
  const { format, photo, photo2 } = socialOptions(req.url);
  const players = format === "post" ? await preMatchPlayers(photo, photo2, (await socialAssets()).baseFiles["presentazione-post"]) : [];
  return renderSocial((a) => <PreMatchCard d={{ ...kit.pre, players }} format={format} a={a} />, format);
}
