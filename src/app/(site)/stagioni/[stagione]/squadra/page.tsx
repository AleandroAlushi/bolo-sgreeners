import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import type { RosterBadge } from "@/components/player";
import { RosterGrid } from "@/components/roster-grid";
import { TeamTabs } from "@/components/team-tabs";
import { EmptyState } from "@/components/ui";
import { resolveSeason } from "@/lib/data/params";
import { getSeasonRoster } from "@/lib/data/players";
import { getSeasons } from "@/lib/data/seasons";

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/squadra">): Promise<Metadata> {
  const { stagione } = await params;
  return { title: `Squadra ${stagione}`, description: `Roster e staff dei Bolo Sgreeners nella stagione ${stagione}.` };
}

async function Roster({ params }: { params: Promise<{ stagione: string }> }) {
  const [season, seasons] = await Promise.all([resolveSeason(params), getSeasons()]);
  // il roster contiene già solo chi ha giocato, più le eccezioni indicate dalla squadra (import storico)
  const roster = await getSeasonRoster(season.id);
  const firstSeason = seasons.map((s) => s.slug).sort()[0];
  return (
    <>
      <TeamTabs seasonSlug={season.slug} active="roster" />
      {roster.length === 0 ? (
        <EmptyState title="Roster non disponibile">I giocatori di questa stagione non sono ancora stati inseriti.</EmptyState>
      ) : (
        <RosterGrid
          items={roster.map((p) => {
            const badges: RosterBadge[] = [];
            if (p.is_captain) badges.push("captain");
            if (p.is_vice_captain) badges.push("vice");
            if (p.staff_role) badges.push("staff");
            else if (p.first_season_slug === season.slug && season.slug !== firstSeason) badges.push("new");
            return {
              slug: p.player_slug!,
              firstName: p.first_name!,
              lastName: p.last_name!,
              nickname: p.nickname,
              jersey: p.jersey_number,
              role: p.role,
              photoPath: p.photo_path,
              badges,
            };
          })}
        />
      )}
    </>
  );
}

export default function SquadPage(props: PageProps<"/stagioni/[stagione]/squadra">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <Roster params={props.params} />
    </Suspense>
  );
}
