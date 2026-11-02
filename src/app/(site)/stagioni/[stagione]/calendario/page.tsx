import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar-view";
import { LoadingBlock } from "@/components/loading";
import { SeasonCalendarButton } from "@/components/match-actions";
import { EmptyState, Notice } from "@/components/ui";
import { getLeagueResults, getSeasonMatches } from "@/lib/data/matches";
import { resolveSeason } from "@/lib/data/params";

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/calendario">): Promise<Metadata> {
  const { stagione } = await params;
  return { title: `Calendario ${stagione}`, description: `Calendario e risultati dei Bolo Sgreeners nella stagione ${stagione}.` };
}

async function Calendar({ params }: { params: Promise<{ stagione: string }> }) {
  const season = await resolveSeason(params);
  const [matches, league] = await Promise.all([getSeasonMatches(season.id), getLeagueResults(season.id)]);
  if (matches.length === 0) return <EmptyState title="Calendario non disponibile">Le partite di questa stagione non sono ancora state inserite.</EmptyState>;
  const onlyOwn = league.length === 0 && matches.every((m) => m.involves_own_team);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Tutte le partite dei Bolo Sgreeners, anche nel tuo calendario.</p>
        <SeasonCalendarButton path={`/ics/stagione/${season.slug}`} />
      </div>
      {onlyOwn && (
        <Notice>
          Al momento sono in archivio solo le partite dei Bolo Sgreeners: il calendario completo del campionato verrà
          aggiunto importandolo dal CSI.
        </Notice>
      )}
      <div id="giornate" className="scroll-mt-24">
        <CalendarView matches={matches} league={league} competitions={season.competitions.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </div>
  );
}

export default function CalendarPage(props: PageProps<"/stagioni/[stagione]/calendario">) {
  return (
    <Suspense fallback={<LoadingBlock rows={8} />}>
      <Calendar params={props.params} />
    </Suspense>
  );
}
