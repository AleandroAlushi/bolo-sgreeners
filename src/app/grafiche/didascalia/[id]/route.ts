import { adminKit } from "@/lib/graphics/social/route";

/** Didascalie da copiare su Instagram (bozze): /grafiche/didascalia/<id> → JSON */
export async function GET(_req: Request, ctx: RouteContext<"/grafiche/didascalia/[id]">) {
  const kit = await adminKit((await ctx.params).id);
  if (kit instanceof Response) return kit;
  return Response.json(
    { pre: kit.preCaption, post: kit.postCaption, mvp: kit.mvp ? { name: kit.mvp.data.name, auto: kit.mvp.auto } : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
