import { AdminSection } from "@/components/admin/fields";
import { CutoutManager, type CutoutPlayer } from "@/components/admin/cutout-manager";
import { GraphicsStudio, type StudioMatch } from "@/components/admin/graphics-studio";
import { requireAdmin } from "@/lib/admin/auth";
import { publicMediaUrl } from "@/lib/media";
import { romeNow } from "@/lib/push";

const fmtDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtMonth = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function GraphicsPage() {
  const { supabase } = await requireAdmin();
  const { data: seasons } = await supabase.from("seasons").select("id, slug, is_current").order("slug", { ascending: false });
  const season = (seasons ?? []).find((s) => s.is_current) ?? seasons?.[0];
  if (!season) return <p className="text-sm text-muted">Nessuna stagione.</p>;
  // stagione in corso più le ultime partite della precedente (utili a inizio stagione)
  const previous = (seasons ?? []).find((s) => s.slug < season.slug);
  const [{ data: roster }, { data: cutouts }] = await Promise.all([
    supabase.from("v_season_roster").select("player_id, display_name, jersey_number, photo_path").eq("season_id", season.id),
    supabase.from("season_rosters").select("player_id, cutout_path").eq("season_id", season.id),
  ]);
  const players: CutoutPlayer[] = (roster ?? [])
    .filter((r) => r.player_id)
    .sort((a, b) => Number(a.jersey_number ?? 999) - Number(b.jersey_number ?? 999))
    .map((r) => ({
      playerId: r.player_id!,
      name: r.display_name ?? "",
      jersey: r.jersey_number,
      photo: publicMediaUrl(r.photo_path),
      cutout: publicMediaUrl((cutouts ?? []).find((c) => c.player_id === r.player_id)?.cutout_path),
    }));
  const { data: rows } = await supabase
      .from("v_matches")
      .select("id, match_date, start_time, opponent_name, own_score, opponent_score, status, has_box_score, season_slug, season_id")
      .in("season_id", [season.id, previous?.id].filter((x): x is string => Boolean(x)))
      .eq("involves_own_team", true)
      .order("match_date", { ascending: false, nullsFirst: false });
  const current = (rows ?? []).filter((m) => m.season_id === season.id);
  const older = (rows ?? []).filter((m) => m.season_id !== season.id).slice(0, 6);
  const matches: StudioMatch[] = [...current, ...older]
    .filter((m) => m.id)
    .map((m) => {
      const played = (m.status === "played" || m.status === "forfeit") && m.own_score !== null;
      return {
        id: m.id!,
        label: `${m.match_date ? fmtDay.format(new Date(`${m.match_date}T12:00:00Z`)) : "da fissare"} · ${m.opponent_name ?? "?"}${played ? ` · ${m.own_score}-${m.opponent_score}` : ""}${m.season_id === season.id ? "" : ` (${m.season_slug})`}`,
        date: m.match_date,
        played,
        hasBoxScore: Boolean(m.has_box_score),
      };
    });
  const months = [...new Set(current.map((m) => m.match_date?.slice(0, 7)).filter((x): x is string => Boolean(x)))]
    .sort()
    .map((v) => ({ value: v, label: fmtMonth.format(new Date(`${v}-01T12:00:00Z`)) }));
  return (
    <>
      <h1 className="display text-3xl">Grafiche</h1>
      <p className="text-sm text-muted">
        Post e storie per Instagram con i dati del sito. La mattina della partita trovi la presentazione pronta; dopo la partita
        importa il box score (Importa partita) per finale, MVP, box score, leader e didascalia. Loghi e sigle degli avversari si
        impostano in Squadre, i profili Instagram dei giocatori nei loro dati riservati.
      </p>
      <AdminSection title={`Stagione ${season.slug}`}>
        <GraphicsStudio matches={matches} months={months} seasonSlug={season.slug} today={romeNow().date} />
      </AdminSection>
      <AdminSection
        title="Scontorni dei giocatori"
        description="Per MVP e leader della partita: il giocatore senza sfondo, ricavato dalla foto della stagione o da un'altra foto caricata qui. Lo scontorno lo fa il browser (la prima volta scarica il modello, qualche secondo)."
      >
        <CutoutManager seasonId={season.id} players={players} />
      </AdminSection>
    </>
  );
}
