import { LeadersCard, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit, leaderPhoto } from "@/lib/graphics/social/route";

/** Leader della partita (assist, punti, recuperi, rimbalzi) con il mezzo busto: /grafiche/leader/<id> */
export async function GET(_req: Request, ctx: RouteContext<"/grafiche/leader/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (!kit.hasBoxScore) return new Response("Statistiche della partita non ancora caricate (importa il box score)", { status: 404 });
  const leaders = await Promise.all(kit.leaders.map(async (l) => ({ ...l, photo: await leaderPhoto(l.photo) })));
  return renderSocial((a) => <LeadersCard leaders={leaders} a={a} />);
}
