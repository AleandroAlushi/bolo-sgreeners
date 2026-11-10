import { PreMatchCard, SOCIAL_SIZES, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit, safePhoto, socialOptions } from "@/lib/graphics/social/route";

/** Presentazione della partita (mattina della gara): /grafiche/presentazione/<id>?formato=post|storia&foto= */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/presentazione/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  const { format, photo } = socialOptions(req.url);
  const tinted = await safePhoto(photo, 602, SOCIAL_SIZES[format].height, "tinta");
  return renderSocial((a) => <PreMatchCard d={{ ...kit.pre, photo: tinted }} format={format} a={a} />, format);
}
