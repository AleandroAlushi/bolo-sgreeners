import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { PhotoViewer } from "@/components/photo-viewer";
import { StaffCard } from "@/components/player";
import { StaffEasterEgg, type EvilCard } from "@/components/staff-easter-egg";
import { TeamTabs } from "@/components/team-tabs";
import { EmptyState } from "@/components/ui";
import { resolveSeason } from "@/lib/data/params";
import { getSeasonStaff } from "@/lib/data/players";
import { publicMediaUrl } from "@/lib/media";

/** Easter egg dei tiri liberi: le versioni "evil" di coach e vice 2026-27, nello storage del sito. */
const EVIL_SEASON = "2026-27";
const EVIL_PHOTOS: Record<string, string> = {
  "francesco-cassanelli": "staff/easter-egg/francesco-cassanelli-evil.jpg",
  "cesare-betti": "staff/easter-egg/cesare-betti-evil.jpg",
};

export async function generateMetadata({ params }: PageProps<"/stagioni/[stagione]/squadra/staff">): Promise<Metadata> {
  const { stagione } = await params;
  return { title: `Staff ${stagione}`, description: `Lo staff dei Bolo Sgreeners nella stagione ${stagione}.` };
}

async function Staff({ params }: { params: Promise<{ stagione: string }> }) {
  const season = await resolveSeason(params);
  const staff = await getSeasonStaff(season.id);
  // foto apribili in grande: solo chi ce l'ha, nell'ordine delle card
  // (solo le foto di questa stagione, non quella predefinita della persona)
  const withPhoto = staff.filter((s) => s.season_photo_path);
  const evil: EvilCard[] =
    season.slug === EVIL_SEASON
      ? staff
          .filter((s) => s.slug && EVIL_PHOTOS[s.slug])
          .map((s) => ({ firstName: s.first_name!, lastName: s.last_name!, role: s.role!, photoPath: EVIL_PHOTOS[s.slug!], url: publicMediaUrl(EVIL_PHOTOS[s.slug!])! }))
      : [];
  return (
    <>
      <TeamTabs seasonSlug={season.slug} active="staff" />
      {staff.length === 0 ? (
        <EmptyState title="Staff non disponibile">Lo staff di questa stagione non è ancora stato inserito.</EmptyState>
      ) : (
        <PhotoViewer photos={withPhoto.map((s) => ({ url: publicMediaUrl(s.season_photo_path)!, caption: `${s.first_name} ${s.last_name} · ${s.role} · ${season.slug}` }))}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {staff.map((s) => (
            <StaffCard
              key={`${s.staff_id}-${s.role}`}
              firstName={s.first_name!}
              lastName={s.last_name!}
              role={s.role!}
              photoPath={s.season_photo_path}
              playerSlug={s.player_slug}
              gamesAsPlayer={s.games_as_player}
              photoIndex={s.season_photo_path ? withPhoto.indexOf(s) : undefined}
              extra={
                /^allenatore$/i.test(s.role ?? "") && season.played > 0 ? (
                  <>
                    Record <span className="font-semibold text-text">{season.wins}-{season.losses}</span>
                  </>
                ) : undefined
              }
            />
            ))}
          </div>
        </PhotoViewer>
      )}
      {evil.length > 0 && <StaffEasterEgg evil={evil} />}
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
