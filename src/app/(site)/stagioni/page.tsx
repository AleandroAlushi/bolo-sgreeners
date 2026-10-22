import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getSeasons } from "@/lib/data/seasons";
import { getSeasonStandings } from "@/lib/data/standings";
import { formatNumber } from "@/lib/domain/format";

export const metadata: Metadata = {
  title: "Archivio stagioni",
  description: "Tutte le stagioni dei Bolo Sgreeners: record, risultati e piazzamenti.",
};

export default async function SeasonsPage() {
  const seasons = await getSeasons();
  if (seasons.length === 0) return <EmptyState title="Archivio vuoto">Nessuna stagione presente nel database.</EmptyState>;
  const standings = await Promise.all(seasons.map((s) => getSeasonStandings(s.id)));
  return (
    <div>
      <PageHeader eyebrow="Archivio" title="Le stagioni">
        {seasons.length} stagioni nella storia dei Bolo Sgreeners.
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {seasons.map((s, i) => {
          const position = standings[i]
            .filter((c) => c.competition.kind === "regular_season")
            .flatMap((c) => c.rows.filter((r) => r.is_own_team).map((r) => `${r.position}° in ${c.competition.name}`))
            .at(0);
          return (
            <Link key={s.id} href={`/stagioni/${s.slug}`} className="card group block overflow-hidden transition-colors hover:border-primary/40">
              <div className="neon-line h-[3px] opacity-60 group-hover:opacity-100" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="display text-4xl font-extrabold italic leading-none group-hover:text-primary">{s.slug}</p>
                    <p className="mt-1 text-sm text-muted">{s.competitions.map((c) => c.name).join(" · ") || "Nessuna competizione"}</p>
                  </div>
                  {s.is_current && <Badge tone="primary">In corso</Badge>}
                </div>
                {s.played > 0 ? (
                  <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Record</dt>
                      <dd className="display text-2xl font-bold">{s.wins}-{s.losses}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">Partite</dt>
                      <dd className="display text-2xl font-bold">{s.played}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">PF/G</dt>
                      <dd className="display text-2xl font-bold">{formatNumber(s.pointsFor / s.played, 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">PS/G</dt>
                      <dd className="display text-2xl font-bold">{formatNumber(s.pointsAgainst / s.played, 1)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 text-sm text-muted">{s.notes ?? "Nessuna partita in archivio."}</p>
                )}
                {position && <p className="mt-3 text-sm font-semibold text-secondary">{position}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
