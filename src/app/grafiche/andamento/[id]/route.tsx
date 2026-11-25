import { FlowCard, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit } from "@/lib/graphics/social/route";

/** Andamento della partita (dalla diretta del sito): /grafiche/andamento/<id> */
export async function GET(_req: Request, ctx: RouteContext<"/grafiche/andamento/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (!kit.flow || !kit.final) return new Response("Andamento disponibile solo per le partite seguite con le statistiche live", { status: 404 });
  const d = { ...kit.flow, own: { code: kit.final.own.code, score: kit.final.own.score }, opponent: { code: kit.final.opponent.code, score: kit.final.opponent.score } };
  return renderSocial((a) => <FlowCard d={d} a={a} />);
}
