import { FinalCard, PreMatchCard, SOCIAL_SIZES, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit, safePhoto, socialOptions } from "@/lib/graphics/social/route";

/** "Finale" a partita giocata, altrimenti la presentazione: /grafiche/partita/<id>?formato=post|storia&foto= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/partita/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (kit.final) {
    const final = kit.final;
    return renderSocial((a) => <FinalCard d={final} a={a} />);
  }
  const { format, photo } = socialOptions(req.url);
  const tinted = await safePhoto(photo, 602, SOCIAL_SIZES[format].height, "tinta");
  return renderSocial((a) => <PreMatchCard d={{ ...kit.pre, photo: tinted }} format={format} a={a} />, format);
}
