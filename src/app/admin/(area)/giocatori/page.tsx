import Link from "next/link";
import { AdminSection } from "@/components/admin/fields";
import { PlayerForm } from "@/components/admin/player-form";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminPlayersPage() {
  const { supabase } = await requireAdmin();
  const [{ data: players }, { data: rosters }] = await Promise.all([
    supabase.from("players").select("id, first_name, last_name, nickname, slug").order("last_name"),
    supabase.from("v_season_roster").select("player_id, season_slug, jersey_number"),
  ]);
  return (
    <>
      <h1 className="display text-3xl">Giocatori e roster</h1>
      <AdminSection title="Giocatori" description="Un giocatore ha un'unica identità; numero, ruolo e soprannome di stagione si gestiscono nel roster.">
        <ul className="divide-y divide-border/60">
          {(players ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link href={`/admin/giocatori/${p.id}`} className="font-semibold hover:text-primary">
                {p.first_name} {p.last_name} {p.nickname && <span className="text-muted">“{p.nickname}”</span>}
              </Link>
              <span className="text-xs text-muted">
                {(rosters ?? [])
                  .filter((r) => r.player_id === p.id)
                  .map((r) => `${r.season_slug}${r.jersey_number ? ` #${r.jersey_number}` : ""}`)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </AdminSection>
      <AdminSection title="Nuovo giocatore">
        <PlayerForm />
      </AdminSection>
    </>
  );
}
