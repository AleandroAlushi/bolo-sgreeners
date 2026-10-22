import Link from "next/link";
import { Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { formOptions } from "@/lib/admin/queries";

export default async function AdminMatchesPage({ searchParams }: PageProps<"/admin/partite">) {
  const { supabase } = await requireAdmin();
  const { seasons } = await formOptions(supabase);
  const sp = await searchParams;
  const slug = typeof sp.stagione === "string" ? sp.stagione : (seasons.find((s) => s.is_current)?.slug ?? seasons[0]?.slug);
  const season = seasons.find((s) => s.slug === slug) ?? seasons[0];
  const { data: matches } = season
    ? await supabase.from("v_matches").select("*").eq("season_id", season.id).order("match_date", { nullsFirst: false })
    : { data: [] };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Partite</h1>
        <Link href="/admin/partite/nuova" className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-ink">
          Nuova partita
        </Link>
      </div>
      <div className="flex flex-wrap gap-1">
        {seasons.map((s) => (
          <Link key={s.id} href={`/admin/partite?stagione=${s.slug}`} className={`rounded-full px-3 py-1 text-sm font-semibold ${s.id === season?.id ? "bg-primary text-primary-ink" : "bg-surface-2 text-muted"}`}>
            {s.slug}
          </Link>
        ))}
      </div>
      <div className="card -mx-4 overflow-x-auto sm:mx-0">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Partita</th>
              <th>Data</th>
              <th>Fase</th>
              <th>Risultato</th>
              <th>Box score</th>
              <th>Verifica</th>
            </tr>
          </thead>
          <tbody>
            {(matches ?? []).map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/admin/partite/${m.id}`} className="font-semibold hover:text-primary">
                    {m.home_team_name} – {m.away_team_name}
                  </Link>
                </td>
                <td>{m.match_date ?? "n.d."}</td>
                <td>{m.competition_name}</td>
                <td>{m.home_score !== null ? `${m.home_score}-${m.away_score}` : m.status}</td>
                <td>{m.has_box_score ? <Badge tone="win">sì</Badge> : <Badge>no</Badge>}</td>
                <td>{m.verification === "verified" ? <Badge tone="win">ok</Badge> : m.verification === "probable" ? <Badge>probabile</Badge> : <Badge tone="warning">da verificare</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
