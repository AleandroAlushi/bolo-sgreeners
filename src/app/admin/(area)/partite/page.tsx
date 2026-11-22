import Link from "next/link";
import { Badge, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { formOptions } from "@/lib/admin/queries";
import { formatDate, formatTime } from "@/lib/domain/format";

const FILTERS = { "da-giocare": "Da giocare", giocate: "Giocate", tutte: "Tutte" } as const;
type Filter = keyof typeof FILTERS;

/** Partite di una stagione, a schede (comode dal telefono), con filtro da giocare / giocate. */
export default async function AdminMatchesPage({ searchParams }: PageProps<"/admin/partite">) {
  const { supabase } = await requireAdmin();
  const { seasons } = await formOptions(supabase);
  const sp = await searchParams;
  const slug = typeof sp.stagione === "string" ? sp.stagione : (seasons.find((s) => s.is_current)?.slug ?? seasons[0]?.slug);
  const season = seasons.find((s) => s.slug === slug) ?? seasons[0];
  const filter: Filter = typeof sp.mostra === "string" && sp.mostra in FILTERS ? (sp.mostra as Filter) : "tutte";
  const { data: matches } = season
    ? await supabase
        .from("v_matches")
        .select("id, match_date, start_time, opponent_name, own_side, own_score, opponent_score, own_result, status, has_box_score, competition_name, round_label, involves_own_team, home_team_name, away_team_name, home_score, away_score")
        .eq("season_id", season.id)
        .order("match_date", { nullsFirst: false })
        .order("start_time")
    : { data: [] };
  const all = matches ?? [];
  const played = (m: (typeof all)[number]) => m.status === "played" || m.status === "forfeit";
  const list = all.filter((m) => (filter === "da-giocare" ? !played(m) && m.status !== "cancelled" : filter === "giocate" ? played(m) : true));
  const href = (p: { stagione?: string; mostra?: Filter }) => {
    const q = new URLSearchParams({ stagione: p.stagione ?? season?.slug ?? "", ...(p.mostra && p.mostra !== "tutte" ? { mostra: p.mostra } : {}) });
    return `/admin/partite?${q}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Partite</h1>
        <Link href="/admin/partite/nuova" className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-ink">
          Nuova partita
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {seasons.map((s) => (
            <Link key={s.id} href={href({ stagione: s.slug, mostra: filter })} className={cx("rounded-full px-3 py-1 text-sm font-semibold", s.id === season?.id ? "bg-primary text-primary-ink" : "bg-surface-2 text-muted")}>
              {s.slug}
            </Link>
          ))}
        </div>
        <div role="tablist" aria-label="Mostra" className="inline-flex rounded-full border border-border bg-surface p-1">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <Link key={f} role="tab" aria-selected={f === filter} href={href({ mostra: f })} className={cx("rounded-full px-3 py-1 text-sm font-semibold", f === filter ? "bg-surface-2 text-text" : "text-muted")}>
              {FILTERS[f]}
            </Link>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted">Nessuna partita.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => {
            const ours = m.involves_own_team;
            const title = ours ? `${m.own_side === "away" ? "@" : "vs"} ${m.opponent_name ?? "?"}` : `${m.home_team_name} – ${m.away_team_name}`;
            const score = played(m) ? (ours ? `${m.own_score}-${m.opponent_score}` : `${m.home_score}-${m.away_score}`) : null;
            return (
              <li key={m.id} className="card flex items-center gap-3 p-3 sm:p-4">
                <Link href={`/admin/partite/${m.id}`} className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {[formatDate(m.match_date, "day-month"), formatTime(m.start_time), m.round_label ?? m.competition_name].filter(Boolean).join(" · ")}
                  </p>
                  <p className="truncate font-semibold">{title}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {m.status === "postponed" && <Badge tone="warning">rinviata</Badge>}
                    {m.status === "cancelled" && <Badge>annullata</Badge>}
                    {played(m) && ours && (m.has_box_score ? <Badge tone="win">statistiche</Badge> : <Badge tone="warning">senza statistiche</Badge>)}
                    {!ours && <Badge>altre squadre</Badge>}
                  </p>
                </Link>
                {score ? (
                  <span className={cx("display shrink-0 text-2xl tabular-nums", m.own_result === "W" ? "text-win" : m.own_result === "L" ? "text-loss" : "text-text")}>{score}</span>
                ) : ours && m.status === "scheduled" ? (
                  <Link href={`/area-squadra/live?partita=${m.id}`} className="shrink-0 rounded-full border border-loss/50 px-3 py-1.5 text-xs font-bold text-loss">
                    Live
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
