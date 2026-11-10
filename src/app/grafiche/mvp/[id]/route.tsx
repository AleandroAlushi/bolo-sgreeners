import { MvpCard, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit, safePhoto, socialOptions } from "@/lib/graphics/social/route";

/** MVP della partita (indicato dall'admin o calcolato): /grafiche/mvp/<id>?foto= (senza foto: quella del roster) */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/mvp/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (!kit.mvp) return new Response("Serve il box score della partita (Importa partita)", { status: 404 });
  const { photo } = socialOptions(req.url);
  const data = { ...kit.mvp.data, photo: await safePhoto(photo ?? kit.mvp.data.photo, 520, 910, "ritaglio") };
  return renderSocial((a) => <MvpCard d={data} a={a} />);
}
