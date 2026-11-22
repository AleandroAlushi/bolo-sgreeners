import { AdminSection } from "@/components/admin/fields";
import { MediaManager, type MediaPerson } from "@/components/admin/media-manager";
import { requireAdmin } from "@/lib/admin/auth";

/** Foto e video della stagione in corso: caricatura, video in loop, scontorno e foto in partita. */
export default async function MediaPage() {
  const { supabase } = await requireAdmin();
  const { data: seasons } = await supabase.from("seasons").select("id, slug, is_current").order("slug", { ascending: false });
  const season = (seasons ?? []).find((s) => s.is_current) ?? seasons?.[0];
  if (!season) return <p className="text-sm text-muted">Nessuna stagione.</p>;

  const [roster, rosterRows, staff, gallery] = await Promise.all([
    supabase.from("v_season_roster").select("player_id, player_slug, first_name, last_name, nickname, jersey_number, season_photo_path, season_video_path").eq("season_id", season.id),
    supabase.from("season_rosters").select("player_id, cutout_path").eq("season_id", season.id),
    supabase.from("v_season_staff").select("staff_id, slug, first_name, last_name, role, season_photo_path, season_video_path, player_id").eq("season_id", season.id).order("sort_order"),
    supabase.storage.from("media").list("foto-partita", { limit: 200 }),
  ]);
  const playerIds = (roster.data ?? []).map((r) => r.player_id!);
  const staffIds = [...new Set((staff.data ?? []).map((s) => s.staff_id!))];
  const [players, staffMembers, galleryFiles] = await Promise.all([
    supabase.from("players").select("id, photo_path").in("id", playerIds.length ? playerIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("staff_members").select("id, photo_path").in("id", staffIds.length ? staffIds : ["00000000-0000-0000-0000-000000000000"]),
    Promise.all(
      (gallery.data ?? [])
        .filter((f) => !f.id)
        .map(async (f) => {
          const { data } = await supabase.storage.from("media").list(`foto-partita/${f.name}`, { limit: 200, sortBy: { column: "name", order: "asc" } });
          return [f.name, (data ?? []).filter((x) => /\.(png|jpe?g)$/i.test(x.name)).map((x) => `foto-partita/${f.name}/${x.name}`)] as const;
        }),
    ),
  ]);
  const galleryOf = new Map(galleryFiles);

  const people: MediaPerson[] = [
    ...(roster.data ?? [])
      .sort((a, b) => Number(a.jersey_number ?? 999) - Number(b.jersey_number ?? 999))
      .map((r) => ({
        kind: "player" as const,
        id: r.player_id!,
        slug: r.player_slug!,
        name: `${r.first_name} ${r.last_name}${r.nickname ? ` “${r.nickname}”` : ""}`,
        sub: r.jersey_number ? `#${r.jersey_number}` : "giocatore",
        caricature: (players.data ?? []).find((p) => p.id === r.player_id)?.photo_path ?? null,
        seasonPhoto: r.season_photo_path,
        video: r.season_video_path,
        cutout: (rosterRows.data ?? []).find((x) => x.player_id === r.player_id)?.cutout_path ?? null,
        gallery: galleryOf.get(r.player_slug!) ?? [],
      })),
    // staff: una scheda per persona (anche con più ruoli); chi è anche giocatore sta già sopra
    ...staffIds
      .map((id) => (staff.data ?? []).filter((s) => s.staff_id === id))
      .filter((rows) => !rows[0].player_id || !playerIds.includes(rows[0].player_id))
      .map((rows) => ({
        kind: "staff" as const,
        id: rows[0].staff_id!,
        slug: rows[0].slug!,
        name: `${rows[0].first_name} ${rows[0].last_name}`,
        sub: `Staff · ${rows.map((r) => r.role).join(", ")}`,
        caricature: (staffMembers.data ?? []).find((s) => s.id === rows[0].staff_id)?.photo_path ?? null,
        seasonPhoto: rows[0].season_photo_path,
        video: rows.find((r) => r.season_video_path)?.season_video_path ?? null,
      })),
  ];

  return (
    <>
      <div>
        <h1 className="display text-3xl">Foto e video</h1>
        <p className="text-sm text-muted">
          Tutto quello che serve per ogni persona della stagione {season.slug}, da caricare anche dal telefono: caricatura, video in loop,
          scontorno per le grafiche e foto in partita.
        </p>
      </div>
      <AdminSection title={`Stagione ${season.slug}`} description="Tocca una persona per vedere e cambiare le sue foto e il suo video.">
        <MediaManager people={people} seasonId={season.id} seasonSlug={season.slug} />
      </AdminSection>
    </>
  );
}
