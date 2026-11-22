import Link from "next/link";
import { AdminSearch } from "@/components/admin/admin-search";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate } from "@/lib/domain/format";

/** Ricerca rapida nell'area admin: giocatori, staff, squadre e partite. */
export default async function AdminSearchPage({ searchParams }: PageProps<"/admin/cerca">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);
  // caratteri speciali dei filtri PostgREST tolti: la ricerca è solo testo
  const term = q.replace(/[%_,()*\\]/g, " ").trim();
  const like = `%${term}%`;
  const [players, staff, teams, matches] = term
    ? await Promise.all([
        supabase.from("players").select("id, first_name, last_name, nickname").or(`first_name.ilike.${like},last_name.ilike.${like},nickname.ilike.${like}`).order("last_name").limit(10),
        supabase.from("staff_members").select("id, slug, first_name, last_name").or(`first_name.ilike.${like},last_name.ilike.${like}`).order("last_name").limit(10),
        supabase.from("teams").select("id, name").ilike("name", like).order("name").limit(10),
        supabase.from("v_matches").select("id, match_date, opponent_name, own_side, own_score, opponent_score, season_slug").eq("involves_own_team", true).ilike("opponent_name", like).order("match_date", { ascending: false }).limit(10),
      ])
    : [null, null, null, null];
  const groups = [
    { title: "Giocatori", items: (players?.data ?? []).map((p) => ({ href: `/admin/giocatori/${p.id}`, label: `${p.first_name} ${p.last_name}`, hint: p.nickname })) },
    { title: "Staff", items: (staff?.data ?? []).map((s) => ({ href: "/admin/staff", label: `${s.first_name} ${s.last_name}`, hint: null })) },
    { title: "Squadre", items: (teams?.data ?? []).map((t) => ({ href: "/admin/squadre", label: t.name, hint: null })) },
    {
      title: "Partite",
      items: (matches?.data ?? []).map((m) => ({
        href: `/admin/partite/${m.id}`,
        label: `${m.own_side === "away" ? "@" : "vs"} ${m.opponent_name ?? "?"}`,
        hint: [formatDate(m.match_date, "day-month"), m.season_slug, m.own_score !== null ? `${m.own_score}-${m.opponent_score}` : null].filter(Boolean).join(" · "),
      })),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <h1 className="display text-3xl">Cerca</h1>
      <AdminSearch id="cerca-pagina" defaultValue={q} autoFocus />
      {!term ? (
        <p className="text-sm text-muted">Scrivi un nome, un soprannome o una squadra avversaria.</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted">Nessun risultato per «{q}».</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.title} className="card p-4">
              <p className="eyebrow mb-2 text-muted">{g.title}</p>
              <ul className="space-y-1">
                {g.items.map((i) => (
                  <li key={`${i.href}-${i.label}-${i.hint}`}>
                    <Link href={i.href} className="block rounded-lg px-2 py-1.5 hover:bg-surface-2">
                      <span className="font-semibold">{i.label}</span>
                      {i.hint && <span className="text-sm text-muted"> · {i.hint}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
