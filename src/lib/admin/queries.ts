import "server-only";
import type { requireAdmin } from "./auth";

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/** Liste di supporto per i form admin (competizioni, squadre, palestre, stagioni). */
export async function formOptions(supabase: Supabase) {
  const [seasons, competitions, teams, venues, players] = await Promise.all([
    supabase.from("seasons").select("id, slug, label, is_current").order("slug", { ascending: false }),
    supabase.from("competitions").select("id, season_id, name, slug, kind, phase_order").order("phase_order"),
    supabase.from("teams").select("id, name, slug, is_own_team").order("name"),
    supabase.from("venues").select("id, name").order("name"),
    supabase.from("players").select("id, first_name, last_name, slug").order("last_name"),
  ]);
  const s = seasons.data ?? [];
  const slugOf = (id: string) => s.find((x) => x.id === id)?.slug ?? "?";
  return {
    seasons: s,
    competitions: (competitions.data ?? [])
      .map((c) => ({ ...c, season_slug: slugOf(c.season_id) }))
      .sort((a, b) => b.season_slug.localeCompare(a.season_slug) || a.phase_order - b.phase_order),
    teams: teams.data ?? [],
    venues: venues.data ?? [],
    players: (players.data ?? []).map((p) => ({ ...p, name: `${p.first_name} ${p.last_name}` })),
  };
}
