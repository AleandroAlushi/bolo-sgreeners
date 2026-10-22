import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { StaffCard } from "@/components/player";
import { TeamTabs } from "@/components/team-tabs";
import { EmptyState } from "@/components/ui";
import { resolveSeason } from "@/lib/data/params";
import { getSeasonStaff } from "@/lib/data/players";

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/squadra/staff">): Promise<Metadata> {
  const { stagione } = await params;
  return { title: `Staff ${stagione}`, description: `Lo staff dei Bolo Sgreeners nella stagione ${stagione}.` };
}

async function Staff({ params }: { params: Promise<{ stagione: string }> }) {
  const season = await resolveSeason(params);
  const staff = await getSeasonStaff(season.id);
  return (
    <>
      <TeamTabs seasonSlug={season.slug} active="staff" />
      {staff.length === 0 ? (
        <EmptyState title="Staff non disponibile">Lo staff di questa stagione non è ancora stato inserito.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {staff.map((s) => (
            <StaffCard
              key={`${s.staff_id}-${s.role}`}
              name={s.display_name!}
              role={s.role!}
              photoPath={s.photo_path}
              playerSlug={s.player_slug}
              gamesAsPlayer={s.games_as_player}
              extra={
                /^allenatore$/i.test(s.role ?? "") && season.played > 0 ? (
                  <>
                    Record della stagione: <span className="font-semibold text-text">{season.wins}-{season.losses}</span>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function StaffPage(props: PageProps<"/stagioni/[stagione]/squadra/staff">) {
  return (
    <Suspense fallback={<LoadingBlock rows={4} />}>
      <Staff params={props.params} />
    </Suspense>
  );
}
