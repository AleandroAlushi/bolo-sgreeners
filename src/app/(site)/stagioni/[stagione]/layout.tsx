import { Suspense } from "react";
import { SeasonSelector, SeasonTabs } from "@/components/navigation";
import { Badge } from "@/components/ui";
import { resolveSeason, seasonStaticParams } from "@/lib/data/params";
import { getSeasons } from "@/lib/data/seasons";

export const generateStaticParams = seasonStaticParams;

async function SeasonHeader({ params }: { params: Promise<{ stagione: string }> }) {
  const [season, seasons] = await Promise.all([resolveSeason(params), getSeasons()]);
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Stagione</p>
          <h1 className="display text-4xl leading-none sm:text-5xl">{season.slug}</h1>
        </div>
        <div className="flex items-center gap-2">
          {season.is_current && <Badge tone="primary">In corso</Badge>}
          <SeasonSelector seasons={seasons.map((s) => ({ slug: s.slug, label: s.label }))} current={season.slug} />
        </div>
      </div>
      <SeasonTabs seasonSlug={season.slug} />
    </div>
  );
}

export default function SeasonLayout({ children, params }: LayoutProps<"/stagioni/[stagione]">) {
  return (
    <>
      <Suspense fallback={<div className="mb-6 h-28 animate-pulse rounded-2xl bg-surface" />}>
        <SeasonHeader params={params} />
      </Suspense>
      {children}
    </>
  );
}
