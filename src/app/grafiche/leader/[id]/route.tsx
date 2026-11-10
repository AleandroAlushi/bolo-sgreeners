import { LeadersCard, renderSocial } from "@/lib/graphics/social/cards";
import { adminKit, safePlayerPhoto } from "@/lib/graphics/social/route";

/** Leader della partita (punti, rimbalzi, assist, recuperi) con le foto del roster: /grafiche/leader/<id> */
export async function GET(_req: Request, ctx: RouteContext<"/grafiche/leader/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  if (!kit.hasBoxScore) return new Response("Statistiche della partita non ancora caricate (importa il box score)", { status: 404 });
  const leaders = await Promise.all(
    kit.leaders.map(async (l) => {
      const pic = await safePlayerPhoto(l.photo, 210, 240, true);
      return { ...l, photo: pic?.src ?? null, cutout: pic?.cutout ?? false };
    }),
  );
  return renderSocial((a) => <LeadersCard leaders={leaders} a={a} />);
}
