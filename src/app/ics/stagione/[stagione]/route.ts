import { toCalendarMatch, icsHeaders } from "@/lib/calendar";
import { getSeasonMatches } from "@/lib/data/matches";
import { getSeason } from "@/lib/data/seasons";
import { buildCalendar } from "@/lib/domain/ics";

/**
 * Tutte le partite degli Sgreeners di una stagione: /ics/stagione/<stagione>. Con webcal:// ci si
 * iscrive (il calendario si aggiorna da solo), con ?download=1 si scarica il file.
 */
export async function GET(req: Request, ctx: RouteContext<"/ics/stagione/[stagione]">) {
  const { stagione } = await ctx.params;
  const season = await getSeason(stagione);
  if (!season) return new Response("Stagione non trovata", { status: 404 });
  const matches = (await getSeasonMatches(season.id)).filter((m) => m.involves_own_team && m.status !== "cancelled");
  const download = new URL(req.url).searchParams.has("download");
  return new Response(buildCalendar(`Bolo Sgreeners ${season.slug}`, matches.map(toCalendarMatch)), {
    headers: icsHeaders(`sgreeners-${season.slug}.ics`, download),
  });
}
