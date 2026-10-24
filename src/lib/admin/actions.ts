"use server";

/**
 * Server action dell'area admin. Ogni azione verifica l'utente admin (requireAdmin),
 * valida i dati con zod, scrive con il client di sessione (RLS) e invalida la cache pubblica.
 */
import { updateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import {
  checkbox,
  dbMessage,
  fail,
  formObject,
  ok,
  optionalInt,
  optionalNumber,
  optionalText,
  slugify,
  slugSchema,
  zodMessage,
  type ActionState,
} from "@/lib/admin/forms";
import { DATA_TAG } from "@/lib/data/core";
import { normalizePlayerName, normalizeTeamName } from "@/lib/importers/normalize";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

type Admin = Awaited<ReturnType<typeof requireAdmin>>;

async function run(fn: (admin: Admin) => Promise<ActionState>): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const res = await fn(admin);
    if (res.ok) updateTag(DATA_TAG);
    return res;
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Errore imprevisto");
  }
}

/**
 * Dopo un import fatto fuori dall'app (script storico, SQL) le pagine pubbliche restano in cache
 * fino a un'ora, anche dopo un nuovo deploy: questo le rigenera subito.
 */
export async function refreshPublicSite(): Promise<void> {
  await requireAdmin();
  updateTag(DATA_TAG);
  redirect("/admin?aggiornato=1");
}

const idOrNull = z.string().uuid().or(z.literal("")).optional().transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Autenticazione
// ---------------------------------------------------------------------------
export async function signIn(_: ActionState | null, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail("Supabase non è configurato.");
  const parsed = z
    .object({ email: z.string().email("Email non valida"), password: z.string().min(1, "Password obbligatoria") })
    .safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("Credenziali non valide.");
  // stesso login per admin e area squadra: si torna da dove si è partiti
  redirect(fd.get("next") === "/area-squadra" ? "/area-squadra" : "/admin");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function signOutTeam() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/area-squadra/accedi");
}

// ---------------------------------------------------------------------------
// Stagioni e competizioni
// ---------------------------------------------------------------------------
const seasonSchema = z.object({
  id: idOrNull,
  slug: z.string().trim().regex(/^\d{4}-\d{2}$/, "Formato stagione: 2026-27"),
  label: z.string().trim().min(1, "Etichetta obbligatoria"),
  start_date: optionalText,
  end_date: optionalText,
  is_current: checkbox,
  notes: optionalText,
});

export async function saveSeason(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = seasonSchema.safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { id, ...row } = p.data;
    if (row.is_current) {
      const { error } = await supabase.from("seasons").update({ is_current: false }).eq("is_current", true);
      if (error) return fail(dbMessage(error));
    }
    const { error } = id ? await supabase.from("seasons").update(row).eq("id", id) : await supabase.from("seasons").insert(row);
    return error ? fail(dbMessage(error)) : ok(id ? "Stagione aggiornata." : "Stagione creata.");
  });
}

const competitionSchema = z.object({
  id: idOrNull,
  season_id: z.string().uuid(),
  name: z.string().trim().min(1, "Nome obbligatorio"),
  slug: z.string().trim().optional(),
  short_name: optionalText,
  kind: z.enum(["regular_season", "poule", "playoff", "cup", "friendly", "other"]),
  phase_order: optionalInt.transform((v) => v ?? 1),
  csi_project_id: optionalInt,
  format_notes: optionalText,
});

export async function saveCompetition(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = competitionSchema.safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { id, ...row } = p.data;
    const slug = slugSchema.safeParse(row.slug || slugify(row.name));
    if (!slug.success) return fail(zodMessage(slug.error));
    const data = { ...row, slug: slug.data };
    const { error } = id ? await supabase.from("competitions").update(data).eq("id", id) : await supabase.from("competitions").insert(data);
    return error ? fail(dbMessage(error)) : ok(id ? "Competizione aggiornata." : "Competizione creata.");
  });
}

export async function saveCompetitionTeam(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({ competition_id: z.string().uuid(), team_id: z.string().uuid("Scegli una squadra"), display_name: z.string().trim().min(1, "Nome ufficiale obbligatorio"), csi_team_id: optionalInt })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.from("competition_teams").upsert(p.data, { onConflict: "competition_id,team_id" });
    return error ? fail(dbMessage(error)) : ok("Squadra salvata nella competizione.");
  });
}

export async function removeCompetitionTeam(competitionId: string, teamId: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("competition_teams").delete().eq("competition_id", competitionId).eq("team_id", teamId);
    return error ? fail(dbMessage(error)) : ok("Squadra rimossa dalla competizione.");
  });
}

const TIEBREAKERS = ["points", "head_to_head", "quotient_total", "point_quotient", "point_diff", "points_for", "wins"] as const;

export async function saveStandingsRule(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        competition_id: z.string().uuid(),
        points_win: optionalNumber.refine((v) => v !== null, "Punti vittoria obbligatori"),
        points_loss: optionalNumber.refine((v) => v !== null, "Punti sconfitta obbligatori"),
        points_ot_win: optionalNumber,
        points_ot_loss: optionalNumber,
        points_forfeit_win: optionalNumber,
        points_forfeit_loss: optionalNumber,
        tiebreakers: z
          .string()
          .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
          .pipe(z.array(z.enum(TIEBREAKERS)).min(1, "Almeno un criterio")),
        is_verified: checkbox,
        notes: optionalText,
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const row = { ...p.data, points_win: p.data.points_win!, points_loss: p.data.points_loss! };
    const { error } = await supabase.from("standings_rules").upsert(row, { onConflict: "competition_id" });
    return error ? fail(dbMessage(error)) : ok("Regole di classifica salvate.");
  });
}

export async function saveAdjustment(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({ competition_id: z.string().uuid(), team_id: z.string().uuid("Scegli una squadra"), points: optionalNumber.refine((v) => v !== null, "Punti obbligatori"), reason: z.string().trim().min(1, "Motivazione obbligatoria") })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.from("standings_adjustments").insert({ ...p.data, points: p.data.points! });
    return error ? fail(dbMessage(error)) : ok("Penalizzazione/correzione registrata.");
  });
}

export async function deleteAdjustment(id: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("standings_adjustments").delete().eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Correzione eliminata.");
  });
}

// ---------------------------------------------------------------------------
// Squadre
// ---------------------------------------------------------------------------
export async function saveTeam(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({ id: idOrNull, name: z.string().trim().min(1, "Nome obbligatorio"), slug: z.string().trim().optional(), short_name: optionalText, city: optionalText, notes: optionalText })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { id, ...row } = p.data;
    const slug = slugSchema.safeParse(row.slug || slugify(row.name));
    if (!slug.success) return fail(zodMessage(slug.error));
    // logo per le grafiche (PNG con sfondo trasparente è l'ideale)
    const logo = await uploadPhoto(supabase, fd, "teams", slug.data);
    if (logo && typeof logo === "object") return fail(logo.error);
    const data = { ...row, slug: slug.data, ...(logo ? { logo_path: logo } : {}) };
    const { error } = id ? await supabase.from("teams").update(data).eq("id", id) : await supabase.from("teams").insert(data);
    return error ? fail(dbMessage(error)) : ok(id ? "Squadra aggiornata." : "Squadra creata.");
  });
}

export async function addTeamAlias(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z.object({ team_id: z.string().uuid(), alias: z.string().trim().min(1, "Alias obbligatorio"), season_id: idOrNull }).safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.from("team_aliases").insert({ ...p.data, alias_normalized: normalizeTeamName(p.data.alias) });
    return error ? fail(dbMessage(error)) : ok("Alias squadra aggiunto.");
  });
}

export async function deleteTeamAlias(id: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("team_aliases").delete().eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Alias eliminato.");
  });
}

// ---------------------------------------------------------------------------
// Giocatori, roster, alias
// ---------------------------------------------------------------------------
export async function savePlayer(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        id: idOrNull,
        first_name: z.string().trim().min(1, "Nome obbligatorio"),
        last_name: z.string().trim().min(1, "Cognome obbligatorio"),
        slug: z.string().trim().optional(),
        nickname: optionalText,
        height_cm: optionalInt.refine((v) => v === null || (v >= 120 && v <= 240), "Altezza in centimetri, tra 120 e 240"),
        hand: z.enum(["destro", "mancino", ""]).optional().transform((v) => (v ? v : null)),
        bio: optionalText,
        notes: optionalText,
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { id, ...row } = p.data;
    const slug = slugSchema.safeParse(row.slug || slugify(`${row.first_name} ${row.last_name}`));
    if (!slug.success) return fail(zodMessage(slug.error));
    let photo_path: string | undefined;
    const photo = fd.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/")) return fail("La foto deve essere un'immagine.");
      if (photo.size > 5 * 1024 * 1024) return fail("Foto troppo grande (massimo 5 MB).");
      const ext = photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
      photo_path = `players/${slug.data}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(photo_path, photo, { contentType: photo.type });
      if (upErr) return fail(`Caricamento foto non riuscito: ${upErr.message}`);
    }
    const data = { ...row, slug: slug.data, ...(photo_path ? { photo_path } : {}) };
    const { error } = id ? await supabase.from("players").update(data).eq("id", id) : await supabase.from("players").insert(data);
    return error ? fail(dbMessage(error)) : ok(id ? "Giocatore aggiornato." : "Giocatore creato.");
  });
}

export async function saveRosterEntry(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        season_id: z.string().uuid("Scegli una stagione"),
        player_id: z.string().uuid(),
        jersey_number: optionalText.refine((v) => v === null || /^\d{1,3}$/.test(v), "Numero di maglia non valido"),
        role: optionalText,
        nickname: optionalText,
        is_active: checkbox,
        is_captain: checkbox,
        is_vice_captain: checkbox,
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.from("season_rosters").upsert(p.data, { onConflict: "season_id,player_id" });
    return error ? fail(dbMessage(error)) : ok("Roster aggiornato.");
  });
}

export async function removeRosterEntry(seasonId: string, playerId: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("season_rosters").delete().eq("season_id", seasonId).eq("player_id", playerId);
    return error ? fail(dbMessage(error)) : ok("Giocatore rimosso dal roster.");
  });
}

export async function addPlayerAlias(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        player_id: z.string().uuid("Scegli un giocatore"),
        alias: z.string().trim().min(1, "Alias obbligatorio"),
        season_id: idOrNull,
        jersey_number: optionalText.refine((v) => v === null || /^\d{1,3}$/.test(v), "Numero non valido"),
        notes: optionalText,
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.from("player_aliases").insert({ ...p.data, alias_normalized: normalizePlayerName(p.data.alias) });
    return error ? fail(dbMessage(error)) : ok("Alias aggiunto.");
  });
}

export async function deletePlayerAlias(id: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("player_aliases").delete().eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Alias eliminato.");
  });
}

// ---------------------------------------------------------------------------
// Partite
// ---------------------------------------------------------------------------
async function manualSourceId(supabase: Admin["supabase"]) {
  const { data, error } = await supabase
    .from("data_sources")
    .upsert({ source_key: "manual-admin", kind: "manual", label: "Inserimento manuale (admin)" }, { onConflict: "source_key" })
    .select("id")
    .single();
  if (error) throw new Error(dbMessage(error));
  return data.id;
}

const matchSchema = z
  .object({
    id: idOrNull,
    competition_id: z.string().uuid("Scegli la competizione"),
    round_number: optionalInt,
    round_label: optionalText,
    match_date: optionalText,
    start_time: optionalText,
    venue_id: idOrNull,
    new_venue_name: optionalText,
    new_venue_address: optionalText,
    home_team_id: z.string().uuid("Scegli la squadra di casa"),
    away_team_id: z.string().uuid("Scegli la squadra ospite"),
    home_score: optionalInt,
    away_score: optionalInt,
    status: z.enum(["scheduled", "played", "postponed", "cancelled", "forfeit"]),
    home_away_confirmed: checkbox,
    verification: z.enum(["verified", "probable", "to_verify"]),
    csi_match_id: optionalInt,
    csi_game_code: optionalText,
    notes: optionalText,
  })
  .refine((m) => m.home_team_id !== m.away_team_id, "Le due squadre devono essere diverse")
  .refine((m) => !["played", "forfeit"].includes(m.status) || (m.home_score !== null && m.away_score !== null), "Per una partita giocata servono entrambi i punteggi");

export async function saveMatch(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = matchSchema.safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { id, new_venue_name, new_venue_address, ...row } = p.data;
    let venue_id = row.venue_id;
    if (!venue_id && new_venue_name) {
      const { data, error } = await supabase.from("venues").insert({ name: new_venue_name, address: new_venue_address }).select("id").single();
      if (error) return fail(dbMessage(error));
      venue_id = data.id;
    }
    const manual = await manualSourceId(supabase);
    let result_source_id: string | undefined;
    if (id) {
      const { data: prev } = await supabase.from("matches").select("home_score, away_score").eq("id", id).single();
      if (prev && (prev.home_score !== row.home_score || prev.away_score !== row.away_score)) result_source_id = manual;
    } else if (row.home_score !== null) {
      result_source_id = manual;
    }
    const data = { ...row, venue_id, ...(result_source_id ? { result_source_id } : {}), ...(!id ? { schedule_source_id: manual } : {}) };
    if (id) {
      const { error } = await supabase.from("matches").update(data).eq("id", id);
      return error ? fail(dbMessage(error)) : ok("Partita aggiornata.");
    }
    const { data: created, error } = await supabase.from("matches").insert(data).select("id").single();
    if (error) return fail(dbMessage(error));
    updateTag(DATA_TAG);
    redirect(`/admin/partite/${created.id}`);
  });
}

export async function deleteMatch(id: string) {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("matches").delete().eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Partita eliminata.");
  });
  redirect("/admin/partite");
}

const STAT_FIELDS = ["minutes", "points", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "tov", "blk", "pf", "plus_minus"] as const;

/** Correzione manuale di una riga statistica: la modifica resta tracciata in source_conflicts. */
export async function savePlayerLine(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const raw = formObject(fd);
    const id = z.string().uuid().safeParse(raw.id);
    if (!id.success) return fail("Riga non valida.");
    const values: Record<string, number | null> = {};
    for (const f of STAT_FIELDS) {
      const v = optionalNumber.safeParse(raw[f]);
      if (!v.success) return fail(`${f}: valore non valido`);
      values[f] = v.data;
    }
    const player = idOrNull.safeParse(raw.player_id);
    const { data: prev, error: e1 } = await supabase.from("player_match_stats").select("*").eq("id", id.data).single();
    if (e1) return fail(dbMessage(e1));
    const changes = STAT_FIELDS.filter((f) => prev[f] !== values[f] && !(prev[f] !== null && values[f] !== null && Number(prev[f]) === values[f]));
    const playerChanged = player.success && player.data !== prev.player_id;
    if (changes.length === 0 && !playerChanged) return ok("Nessuna modifica.");
    const { error } = await supabase
      .from("player_match_stats")
      .update({ ...values, ...(playerChanged ? { player_id: player.data } : {}) })
      .eq("id", id.data);
    if (error) return fail(dbMessage(error));
    const manual = await manualSourceId(supabase);
    await supabase.from("source_conflicts").upsert(
      {
        entity_type: "player_match_stats",
        entity_id: id.data,
        match_id: prev.match_id,
        field: "manual_correction",
        primary_source_id: manual,
        primary_value: [...changes.map((f) => `${f}=${values[f] ?? "–"}`), ...(playerChanged ? [`player_id=${player.data}`] : [])].join(", "),
        secondary_source_id: prev.source_id,
        secondary_value: [...changes.map((f) => `${f}=${prev[f] ?? "–"}`), ...(playerChanged ? [`player_id=${prev.player_id}`] : [])].join(", "),
        description: "Correzione manuale di una riga del box score",
        status: "resolved",
        resolution_note: "Valore corretto dall'admin",
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,entity_id,field,secondary_source_id" },
    );
    return ok("Riga aggiornata (correzione tracciata).");
  });
}

// ---------------------------------------------------------------------------
// Discrepanze tra fonti
// ---------------------------------------------------------------------------
export async function updateConflict(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({ id: z.string().uuid(), status: z.enum(["open", "acknowledged", "resolved"]), resolution_note: optionalText })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { id, ...row } = p.data;
    const { error } = await supabase
      .from("source_conflicts")
      .update({ ...row, resolved_at: row.status === "resolved" ? new Date().toISOString() : null })
      .eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Discrepanza aggiornata.");
  });
}

// ---------------------------------------------------------------------------
// MVP, staff e dati riservati
// ---------------------------------------------------------------------------

export async function saveMatchMvp(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z.object({ match_id: z.string().uuid(), player_id: idOrNull }).safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { match_id, player_id } = p.data;
    const { error } = player_id
      ? await supabase.from("match_awards").upsert({ match_id, award: "mvp", player_id }, { onConflict: "match_id,award" })
      : await supabase.from("match_awards").delete().eq("match_id", match_id).eq("award", "mvp");
    return error ? fail(dbMessage(error)) : ok(player_id ? "MVP salvato." : "MVP rimosso.");
  });
}

async function uploadPhoto(supabase: Admin["supabase"], fd: FormData, folder: string, slug: string): Promise<string | null | { error: string }> {
  const photo = fd.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  if (!photo.type.startsWith("image/")) return { error: "La foto deve essere un'immagine." };
  if (photo.size > 5 * 1024 * 1024) return { error: "Foto troppo grande (massimo 5 MB)." };
  const ext = photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${folder}/${slug}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, photo, { contentType: photo.type });
  return error ? { error: `Caricamento foto non riuscito: ${error.message}` } : path;
}

export async function saveStaffMember(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        id: idOrNull,
        first_name: z.string().trim().min(1, "Nome obbligatorio"),
        last_name: z.string().trim().min(1, "Cognome obbligatorio"),
        player_id: idOrNull,
        notes: optionalText,
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { id, ...row } = p.data;
    const slug = slugSchema.safeParse(slugify(`${row.first_name} ${row.last_name}`));
    if (!slug.success) return fail(zodMessage(slug.error));
    const photo = await uploadPhoto(supabase, fd, "staff", slug.data);
    if (photo && typeof photo === "object") return fail(photo.error);
    const data = { ...row, ...(photo ? { photo_path: photo } : {}) };
    const { error } = id
      ? await supabase.from("staff_members").update(data).eq("id", id)
      : await supabase.from("staff_members").insert({ ...data, slug: slug.data });
    return error ? fail(dbMessage(error)) : ok(id ? "Staff aggiornato." : "Membro dello staff aggiunto.");
  });
}

export async function saveSeasonStaff(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        season_id: z.string().uuid("Scegli una stagione"),
        staff_id: z.string().uuid("Scegli una persona"),
        role: z.string().trim().min(1, "Ruolo obbligatorio"),
        sort_order: optionalInt,
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.from("season_staff").upsert({ ...p.data, sort_order: p.data.sort_order ?? 0 }, { onConflict: "season_id,staff_id,role" });
    return error ? fail(dbMessage(error)) : ok("Ruolo salvato.");
  });
}

export async function removeSeasonStaff(seasonId: string, staffId: string, role: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("season_staff").delete().eq("season_id", seasonId).eq("staff_id", staffId).eq("role", role);
    return error ? fail(dbMessage(error)) : ok("Ruolo rimosso.");
  });
}

/** Data di nascita e note riservate (visibili solo alla squadra). */
export async function savePrivateProfile(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        player_id: idOrNull,
        staff_id: idOrNull,
        birth_date: optionalText.refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data non valida"),
        year_unknown: checkbox,
        paste_exempt: checkbox,
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { player_id, staff_id, year_unknown, paste_exempt } = p.data;
    // anno non noto: conta solo giorno e mese, salvati nel 2000 (bisestile, per il 29 febbraio)
    const birth_date = p.data.birth_date && year_unknown ? `2000-${p.data.birth_date.slice(5)}` : p.data.birth_date;
    const row = { birth_date, birth_year_known: !year_unknown, paste_exempt };
    if (!player_id === !staff_id) return fail("Indica un giocatore o un membro dello staff.");
    const owner = player_id ? { player_id } : { staff_id: staff_id! };
    const query = supabase.from("private_profiles").select("id");
    const { data: existing } = await (player_id ? query.eq("player_id", player_id) : query.eq("staff_id", staff_id!)).maybeSingle();
    const { error } = existing
      ? await supabase.from("private_profiles").update(row).eq("id", existing.id)
      : await supabase.from("private_profiles").insert({ ...owner, ...row });
    return error ? fail(dbMessage(error)) : ok("Dati riservati salvati.");
  });
}

// ---------------------------------------------------------------------------
// Area squadra: accessi, allenamenti e pause
// ---------------------------------------------------------------------------

export async function setAccessRole(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({ email: z.string().trim().email("Email non valida"), role: z.enum(["team", "admin", ""]) })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.rpc("admin_set_role", { target_email: p.data.email, new_role: p.data.role });
    if (error) return fail(error.message);
    return ok(p.data.role === "" ? "Accesso tolto." : p.data.role === "team" ? "Accesso all'area squadra attivato." : "Ruolo admin assegnato.");
  });
}

export async function saveTrainingSchedule(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        season_id: z.string().uuid(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data di inizio non valida"),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data di fine non valida"),
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    if (p.data.end_date < p.data.start_date) return fail("La fine deve essere dopo l'inizio.");
    const weekdays = fd.getAll("weekdays").map(Number).filter((d) => d >= 1 && d <= 7);
    if (weekdays.length === 0) return fail("Scegli almeno un giorno di allenamento.");
    const { error } = await supabase.from("training_schedule").upsert({ ...p.data, weekdays }, { onConflict: "season_id" });
    return error ? fail(dbMessage(error)) : ok("Allenamenti salvati.");
  });
}

export async function addTrainingBreak(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z
      .object({
        season_id: z.string().uuid(),
        label: z.string().trim().min(1, "Dai un nome alla pausa (es. Vacanze di Natale)"),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data di inizio non valida"),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data di fine non valida"),
      })
      .safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    if (p.data.end_date < p.data.start_date) return fail("La fine deve essere dopo l'inizio.");
    const { error } = await supabase.from("training_breaks").insert(p.data);
    return error ? fail(dbMessage(error)) : ok("Pausa aggiunta.");
  });
}

export async function deleteTrainingBreak(id: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("training_breaks").delete().eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Pausa eliminata.");
  });
}

// ---------------------------------------------------------------------------
// Feedback degli utenti (idee e segnalazioni)
// ---------------------------------------------------------------------------

export async function setFeedbackStatus(id: string, status: "new" | "read" | "done"): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Feedback aggiornato.");
  });
}

export async function saveFeedbackNote(_: ActionState | null, fd: FormData) {
  return run(async ({ supabase }) => {
    const p = z.object({ id: z.string().uuid(), admin_notes: optionalText }).safeParse(formObject(fd));
    if (!p.success) return fail(zodMessage(p.error));
    const { error } = await supabase.from("feedback").update({ admin_notes: p.data.admin_notes }).eq("id", p.data.id);
    return error ? fail(dbMessage(error)) : ok("Nota salvata.");
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  await run(async ({ supabase }) => {
    const { error } = await supabase.from("feedback").delete().eq("id", id);
    return error ? fail(dbMessage(error)) : ok("Feedback eliminato.");
  });
}

// ---------------------------------------------------------------------------
// Grafiche: foto di sfondo caricata per un post o una storia
// ---------------------------------------------------------------------------

export async function uploadGraphicPhoto(fd: FormData): Promise<ActionState & { path?: string }> {
  const { supabase } = await requireAdmin();
  const photo = fd.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return fail("Scegli una foto.");
  // le grafiche sono generate con Satori: solo JPG e PNG
  if (!/^image\/(jpeg|png)$/.test(photo.type)) return fail("La foto deve essere JPG o PNG.");
  if (photo.size > 5 * 1024 * 1024) return fail("Foto troppo grande (massimo 5 MB).");
  const path = `grafiche/${Date.now()}.${photo.type === "image/png" ? "png" : "jpg"}`;
  const { error } = await supabase.storage.from("media").upload(path, photo, { contentType: photo.type });
  return error ? fail(`Caricamento non riuscito: ${error.message}`) : { ...ok("Foto caricata."), path };
}
