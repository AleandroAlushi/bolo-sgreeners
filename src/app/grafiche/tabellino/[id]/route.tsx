import { BoxScoreCard, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit } from "@/lib/graphics/social/route";

/** Box score degli Sgreeners (punti, rimbalzi, assist, recuperi): /grafiche/tabellino/<id> */
export async function GET(_req: Request, ctx: RouteContext<"/grafiche/tabellino/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (!kit.hasBoxScore) return new Response("Statistiche della partita non ancora caricate (importa il box score)", { status: 404 });
  return renderSocial((a) => <BoxScoreCard rows={kit.box} a={a} />);
}
