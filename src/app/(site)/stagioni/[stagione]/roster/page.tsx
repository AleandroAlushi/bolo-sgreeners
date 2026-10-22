import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { PlayerCard } from "@/components/player";
import { EmptyState } from "@/components/ui";
import { resolveSeason } from "@/lib/data/params";
import { getSeasonRoster } from "@/lib/data/players";

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/roster">): Promise<Metadata> {
  const { stagione } = await params;
  return { title: `Roster ${stagione}`, description: `I giocatori dei Bolo Sgreeners nella stagione ${stagione}.` };
}

async function Roster({ params }: { params: Promise<{ stagione: string }> }) {
  const season = await resolveSeason(params);
  const roster = await getSeasonRoster(season.id);
  if (roster.length === 0) return <EmptyState title="Roster non disponibile">I giocatori di questa stagione non sono ancora stati inseriti.</EmptyState>;
  return (
    <div>
      <p className="mb-4 text-sm text-muted">{roster.length} giocatori</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((p) => (
          <PlayerCard
            key={p.player_id}
            slug={p.player_slug!}
            firstName={p.first_name!}
            lastName={p.last_name!}
            nickname={p.nickname}
            jersey={p.jersey_number}
            role={p.role}
            photoPath={p.photo_path}
            meta={`${p.games ?? 0} presenze`}
            inactive={p.is_active === false}
          />
        ))}
      </div>
    </div>
  );
}

export default function RosterPage(props: PageProps<"/stagioni/[stagione]/roster">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <Roster params={props.params} />
    </Suspense>
  );
}
