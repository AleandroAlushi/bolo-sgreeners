import type { MatchView } from "@/lib/data/matches";
import type { CalendarMatch } from "@/lib/domain/ics";
import { env } from "@/lib/env";

/** Partita del database → evento di calendario (link alla pagina della partita sul sito). */
export function toCalendarMatch(m: MatchView): CalendarMatch {
  const round = m.round_label ?? (m.round_number ? `${m.round_number}ª giornata` : null);
  const played = m.status === "played" || m.status === "forfeit";
  return {
    id: m.id!,
    date: m.match_date,
    time: m.start_time,
    home: m.home_team_name ?? "",
    away: m.away_team_name ?? "",
    homeScore: played ? m.home_score : null,
    awayScore: played ? m.away_score : null,
    venue: m.venue_name,
    address: m.venue_address,
    subtitle: [m.competition_name, round].filter(Boolean).join(" · "),
    url: new URL(`/partite/${m.id}`, env.siteUrl).toString(),
  };
}

export const icsHeaders = (fileName: string, download: boolean) => ({
  "Content-Type": "text/calendar; charset=utf-8",
  "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
  "Cache-Control": "public, max-age=900",
});
