import { ImportWizard } from "@/components/admin/import-wizard";
import { requireAdmin } from "@/lib/admin/auth";
import { analyzeMatchFile, confirmMatchImport } from "@/lib/admin/import-actions";

export default async function ImportPage() {
  const { supabase } = await requireAdmin();
  const [seasons, competitions, teams, players] = await Promise.all([
    supabase.from("seasons").select("id, slug, is_current").order("slug", { ascending: false }),
    supabase.from("competitions").select("id, season_id, name").order("phase_order"),
    supabase.from("teams").select("id, name, is_own_team").order("name"),
    supabase.from("players").select("id, first_name, last_name").order("last_name"),
  ]);
  const s = seasons.data ?? [];
  return (
    <>
      <div>
        <h1 className="display text-3xl">Importa partita</h1>
        <p className="text-sm text-muted">
          Carica il box score HTML esportato da Easy Stats. Il file originale viene conservato su Storage e lo stesso file non può
          essere importato due volte.
        </p>
      </div>
      <ImportWizard
        seasons={s.map((x) => ({ id: x.id, slug: x.slug }))}
        defaultSeasonId={s.find((x) => x.is_current)?.id ?? s[0]?.id ?? null}
        competitions={competitions.data ?? []}
        teams={teams.data ?? []}
        players={(players.data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))}
        analyze={analyzeMatchFile}
        confirm={confirmMatchImport}
      />
    </>
  );
}
