import { MvpCard, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit, mvpPhoto, socialOptions } from "@/lib/graphics/social/route";

/**
 * MVP della partita (indicato dall'admin o calcolato): /grafiche/mvp/<id>?foto=
 * Senza foto: la prima della galleria delle foto in partita del giocatore, altrimenti il mezzo busto.
 */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/mvp/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (!kit.mvp) return new Response("Serve il box score della partita (Importa partita)", { status: 404 });
  const { photo } = socialOptions(req.url);
  const m = kit.mvp.data;
  // una foto scelta a mano è una foto in partita (figura intera)
  const pic = await mvpPhoto(photo ?? m.photo, photo ? true : m.full);
  return renderSocial((a) => <MvpCard d={{ name: m.name, stats: m.stats, photo: pic }} a={a} />);
}
