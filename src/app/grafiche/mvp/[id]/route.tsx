import { MvpCard, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit, safePlayerPhoto, socialOptions } from "@/lib/graphics/social/route";

/** MVP della partita (indicato dall'admin o calcolato): /grafiche/mvp/<id>?foto= (senza foto: quella del roster) */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/mvp/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (!kit.mvp) return new Response("Serve il box score della partita (Importa partita)", { status: 404 });
  const { photo } = socialOptions(req.url);
  const pic = await safePlayerPhoto(photo ?? kit.mvp.data.photo, 600, 910);
  const data = { ...kit.mvp.data, photo: pic?.src ?? null, cutout: pic?.cutout ?? false };
  return renderSocial((a) => <MvpCard d={data} a={a} />);
}
