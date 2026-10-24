import { getMonthMatches } from "@/lib/graphics/data";
import { MonthCalendar, render } from "@/lib/graphics/templates";
import { optionsFrom } from "@/lib/graphics/theme";

/** Partite del mese, come nel post del calendario: /grafiche/calendario/<stagione>?mese=2026-11&formato=post|storia */
export async function GET(req: Request, ctx: RouteContext<"/grafiche/calendario/[stagione]">) {
  const { stagione } = await ctx.params;
  const month = new URL(req.url).searchParams.get("mese") ?? "";
  const data = await getMonthMatches(stagione, month);
  if (!data) return new Response("Stagione o mese non validi (mese=aaaa-mm)", { status: 404 });
  const opts = optionsFrom(req.url);
  return render(<MonthCalendar month={month} matches={data.matches} opts={opts} />, opts.format);
}
