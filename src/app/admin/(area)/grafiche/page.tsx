import { AdminSection } from "@/components/admin/fields";
import { GraphicsStudio, type StudioMatch } from "@/components/admin/graphics-studio";
import { requireAdmin } from "@/lib/admin/auth";

const fmtDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtMonth = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function GraphicsPage() {
  const { supabase } = await requireAdmin();
  const { data: seasons } = await supabase.from("seasons").select("id, slug, is_current").order("slug", { ascending: false });
  const season = (seasons ?? []).find((s) => s.is_current) ?? seasons?.[0];
  if (!season) return <p className="text-sm text-muted">Nessuna stagione.</p>;
  // stagione in corso più le ultime partite della precedente (utili a inizio stagione)
  const previous = (seasons ?? []).find((s) => s.slug < season.slug);
  const [{ data: rows }, { data: mvps }] = await Promise.all([
    supabase
      .from("v_matches")
      .select("id, match_date, start_time, opponent_name, own_score, opponent_score, status, has_box_score, season_slug, season_id")
      .in("season_id", [season.id, previous?.id].filter((x): x is string => Boolean(x)))
      .eq("involves_own_team", true)
      .order("match_date", { ascending: false, nullsFirst: false }),
    supabase.from("match_awards").select("match_id").eq("award", "mvp"),
  ]);
  const current = (rows ?? []).filter((m) => m.season_id === season.id);
  const older = (rows ?? []).filter((m) => m.season_id !== season.id).slice(0, 6);
  const matches: StudioMatch[] = [...current, ...older]
    .filter((m) => m.id)
    .map((m) => {
      const played = (m.status === "played" || m.status === "forfeit") && m.own_score !== null;
      return {
        id: m.id!,
        label: `${m.match_date ? fmtDay.format(new Date(`${m.match_date}T12:00:00Z`)) : "da fissare"} · ${m.opponent_name ?? "?"}${played ? ` · ${m.own_score}-${m.opponent_score}` : ""}${m.season_id === season.id ? "" : ` (${m.season_slug})`}`,
        played,
        hasBoxScore: Boolean(m.has_box_score),
        hasMvp: (mvps ?? []).some((a) => a.match_id === m.id),
      };
    });
  const months = [...new Set(current.map((m) => m.match_date?.slice(0, 7)).filter((x): x is string => Boolean(x)))]
    .sort()
    .map((v) => ({ value: v, label: fmtMonth.format(new Date(`${v}-01T12:00:00Z`)) }));
  return (
    <>
      <h1 className="display text-3xl">Grafiche</h1>
      <p className="text-sm text-muted">
        Post e storie per Instagram nello stile della stagione, con i dati del sito. Dopo la partita importa il box score (Importa
        partita) per avere tabellino e MVP; i loghi degli avversari si caricano in Squadre.
      </p>
      <AdminSection title={`Stagione ${season.slug}`}>
        <GraphicsStudio matches={matches} months={months} seasonSlug={season.slug} />
      </AdminSection>
    </>
  );
}
