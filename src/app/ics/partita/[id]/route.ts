import { toCalendarMatch, icsHeaders } from "@/lib/calendar";
import { getMatchDetail } from "@/lib/data/matches";
import { buildCalendar } from "@/lib/domain/ics";

/** Una partita da aggiungere al calendario (Apple Calendar, Outlook…): /ics/partita/<id> */
export async function GET(_: Request, ctx: RouteContext<"/ics/partita/[id]">) {
  const { id } = await ctx.params;
  const detail = await getMatchDetail(id);
  if (!detail?.match.match_date) return new Response("Partita non trovata o senza data", { status: 404 });
  const m = toCalendarMatch(detail.match);
  return new Response(buildCalendar("Bolo Sgreeners", [m]), { headers: icsHeaders(`sgreeners-${m.date}.ics`, true) });
}
