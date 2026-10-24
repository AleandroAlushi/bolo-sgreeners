import { Suspense } from "react";
import Link from "next/link";
import { SeasonSelector } from "@/components/navigation";
import { Badge } from "@/components/ui";
import { resolveSeason, seasonStaticParams } from "@/lib/data/params";
import { getSeasons } from "@/lib/data/seasons";

export const generateStaticParams = seasonStaticParams;

async function SeasonHeader({ params }: { params: Promise<{ stagione: string }> }) {
  const [season, seasons] = await Promise.all([resolveSeason(params), getSeasons()]);
  return (
    <div className="mb-6">
      {/* le sezioni (calendario, classifica…) sono nel menu principale, che segue la stagione scelta */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Link href={`/stagioni/${season.slug}`} className="group" title="Panoramica della stagione">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Stagione <span className="text-muted group-hover:text-text">· panoramica ›</span>
          </p>
          <h1 className="display text-4xl leading-none sm:text-5xl">{season.slug}</h1>
        </Link>
        <div className="flex items-center gap-2">
          {season.is_current && <Badge tone="primary">In corso</Badge>}
          <SeasonSelector seasons={seasons.map((s) => ({ slug: s.slug, label: s.label }))} current={season.slug} />
        </div>
      </div>
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
