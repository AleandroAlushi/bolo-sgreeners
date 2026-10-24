/**
 * Persistenza del dataset storico su Supabase (service role).
 * Le entità di riferimento vengono inserite con upsert sulle chiavi naturali; le statistiche
 * passano dalla stessa funzione SQL usata dall'admin (import_match_report).
 * Di default le righe già presenti NON vengono modificate (eventuali correzioni fatte
 * dall'admin restano intatte); con --update vengono aggiornate.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildMatchReportPayload, normalizePlayerName, normalizeTeamName } from "../../src/lib/importers";
import { normalizeSupabaseUrl } from "../../src/lib/env";
import type { Database, Json, TablesInsert } from "../../src/lib/supabase/database.types";
import type { Dataset } from "./dataset";

type Db = SupabaseClient<Database>;
type TableName = keyof Database["public"]["Tables"];

export function client(): Db {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (vedi .env.example)");
  }
  if (!/^https?:\/\/[^/]+$/.test(url)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL non valido: "${url}". Deve essere del tipo https://<reference-id>.supabase.co`);
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function upsert<T extends TableName>(db: Db, table: T, input: TablesInsert<T>[], onConflict: string, update: boolean) {
  // righe ripetute nelle fonti (es. stesso alias in due fogli): con l'aggiornamento Postgres le rifiuta
  const keyCols = onConflict.split(",");
  const unique = new Map(input.map((r) => [JSON.stringify(keyCols.map((k) => (r as Record<string, unknown>)[k] ?? null)), r]));
  const rows = [...unique.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await db.from(table).upsert(chunk as never, { onConflict, ignoreDuplicates: !update });
    if (error) throw new Error(`Upsert ${table}: ${error.message}`);
  }
}

async function selectAll<T>(db: Db, table: TableName | "v_own_competition_records", columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table as "seasons").select(columns).range(from, from + 999);
    if (error) throw new Error(`Select ${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function persistDataset(ds: Dataset, opts: { uploadFiles: boolean; update: boolean }) {
  const db = client();
  const { update } = opts;
  const step = (s: string) => console.log(`\n▶ ${s}`);

  step("Fonti");
  await upsert(db, "data_sources", ds.sources.map((s) => ({ source_key: s.key, kind: s.kind, label: s.label, url: s.url ?? null, reference_date: s.reference_date ?? null, notes: s.notes ?? null })), "source_key", update);
  const sourceId = new Map((await selectAll<{ id: string; source_key: string | null }>(db, "data_sources", "id,source_key")).map((r) => [r.source_key, r.id]));
  const src = (key: string | null | undefined) => (key ? (sourceId.get(key) ?? null) : null);

  step("Stagioni, squadre, competizioni");
  await upsert(db, "seasons", ds.seasons, "slug", update);
  const seasonId = new Map((await selectAll<{ id: string; slug: string }>(db, "seasons", "id,slug")).map((r) => [r.slug, r.id]));
  await upsert(db, "teams", ds.teams, "slug", update);
  const teamId = new Map((await selectAll<{ id: string; slug: string }>(db, "teams", "id,slug")).map((r) => [r.slug, r.id]));
  await upsert(
    db,
    "competitions",
    ds.competitions.map((c) => ({ season_id: seasonId.get(c.season)!, slug: c.slug, name: c.name, kind: c.kind as Database["public"]["Enums"]["competition_kind"], phase_order: c.phase_order, csi_project_id: c.csi_project_id, format_notes: c.format_notes })),
    "season_id,slug",
    update,
  );
  const seasonSlugById = new Map([...seasonId.entries()].map(([k, v]) => [v, k]));
  const competitionId = new Map(
    (await selectAll<{ id: string; slug: string; season_id: string }>(db, "competitions", "id,slug,season_id")).map((r) => [`${seasonSlugById.get(r.season_id)}/${r.slug}`, r.id]),
  );
  const comp = (season: string, slug: string) => {
    const id = competitionId.get(`${season}/${slug}`);
    if (!id) throw new Error(`Competizione ${season}/${slug} non trovata`);
    return id;
  };
  await upsert(db, "standings_rules", ds.rules.map((r) => ({ competition_id: comp(r.season, r.competition), points_win: r.points_win, points_loss: r.points_loss, points_ot_loss: r.points_ot_loss, tiebreakers: r.tiebreakers, is_verified: r.is_verified, notes: r.notes, source_id: src(r.sourceKey) })), "competition_id", update);
  await upsert(db, "competition_teams", ds.competitionTeams.map((c) => ({ competition_id: comp(c.season, c.competition), team_id: teamId.get(c.team)!, display_name: c.display_name, csi_team_id: c.csi_team_id })), "competition_id,team_id", update);
  if (update) await dropStaleTeamAliases(db, ds, seasonId, teamId);
  await upsert(db, "team_aliases", ds.teamAliases.map((a) => ({ team_id: teamId.get(a.team)!, alias: a.alias, alias_normalized: normalizeTeamName(a.alias), season_id: a.season ? seasonId.get(a.season)! : null, source_id: src(a.sourceKey) })), "alias_normalized,season_id,team_id", update);

  step("Palestre e giocatori");
  await upsert(db, "venues", ds.venues.map((v) => ({ name: v.name, address: v.address, city: v.city })), "name,address", update);
  const venueRows = await selectAll<{ id: string; name: string; address: string | null }>(db, "venues", "id,name,address");
  const venueId = new Map(ds.venues.map((v) => [v.key, venueRows.find((r) => r.name === v.name && r.address === v.address)?.id ?? null]));
  await upsert(db, "players", ds.players, "slug", update);
  const playerRows = await selectAll<{ id: string; slug: string; height_cm: number | null; hand: string | null }>(db, "players", "id,slug,height_cm,hand");
  const playerId = new Map(playerRows.map((r) => [r.slug, r.id]));
  // altezza e mano: senza --update solo dove mancano (l'admin potrebbe averle corrette)
  for (const d of ds.playerDetails) {
    const row = playerRows.find((r) => r.slug === d.player)!;
    const patch = {
      ...(d.height_cm !== null && (update || row.height_cm === null) ? { height_cm: d.height_cm } : {}),
      ...(d.hand !== null && (update || row.hand === null) ? { hand: d.hand } : {}),
    };
    if (Object.keys(patch).length === 0) continue;
    const { error } = await db.from("players").update(patch).eq("id", row.id);
    if (error) throw new Error(`Giocatore ${d.player}: ${error.message}`);
  }
  await upsert(db, "player_aliases", ds.playerAliases.map((a) => ({ player_id: playerId.get(a.player)!, alias: a.alias, alias_normalized: normalizePlayerName(a.alias), season_id: a.season ? seasonId.get(a.season)! : null, jersey_number: a.jersey, source_id: src(a.sourceKey), notes: a.notes })), "alias_normalized,season_id,jersey_number,player_id", update);

  step("Partite e parziali");
  const matchRows = ds.matches.map((m) => ({
      import_key: m.key,
      competition_id: comp(m.season, m.competition),
      round_number: m.round_number,
      round_label: m.round_label,
      match_date: m.date,
      start_time: m.time,
      venue_id: m.venue ? venueId.get(m.venue) ?? null : null,
      home_team_id: teamId.get(m.home)!,
      away_team_id: teamId.get(m.away)!,
      home_score: m.home_score,
      away_score: m.away_score,
      status: m.status === "played" && m.home_score === null ? "scheduled" : m.status,
      home_away_confirmed: m.home_away_confirmed,
      csi_match_id: m.csi_match_id,
      csi_game_code: m.csi_game_code,
      verification: m.verification,
      schedule_source_id: src(m.scheduleSource),
      result_source_id: src(m.resultSource),
      notes: m.notes,
    }));
  // Senza risultato nelle fonti curate non si toccano punteggio e stato: potrebbero arrivare da un box score
  await upsert(db, "matches", matchRows.filter((m) => m.home_score !== null), "import_key", update);
  await upsert(
    db,
    "matches",
    matchRows
      .filter((m) => m.home_score === null)
      .map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !["home_score", "away_score", "status", "result_source_id"].includes(k))) as typeof m),
    "import_key",
    update,
  );
  const matchId = new Map((await selectAll<{ id: string; import_key: string | null }>(db, "matches", "id,import_key")).map((r) => [r.import_key, r.id]));
  if (update) await reassignOpponentRows(db, ds, matchId, teamId);
  await upsert(db, "match_period_scores", ds.periods.map((p) => ({ match_id: matchId.get(p.match)!, team_id: teamId.get(p.team)!, period: p.period, points: p.points, source_id: src(p.sourceKey) })), "match_id,team_id,period", update);
  await upsert(
    db,
    "official_standings",
    ds.standings.map((s) => ({ competition_id: comp(s.season, s.competition), team_id: teamId.get(s.team)!, position: s.position, played: s.played, wins: s.wins, losses: s.losses, ot_losses: s.ot_losses, points: s.points, points_for: s.points_for, points_against: s.points_against, extra: s.extra, as_of: s.asOf, source_id: src(s.sourceKey) })),
    "competition_id,team_id",
    update,
  );

  step("Statistiche partita (import_match_report)");
  const ownTeamId = teamId.get(ds.teams.find((t) => t.is_own_team)!.slug)!;
  const results: Record<string, number> = {};
  for (const imp of ds.statImports) {
    let storagePath: string | null = null;
    if (opts.uploadFiles && imp.content && imp.hash) {
      storagePath = `${imp.season}/${imp.hash}.html`;
      const { error } = await db.storage.from("match-files").upload(storagePath, imp.content, { contentType: "text/html; charset=utf-8", upsert: false });
      if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`Storage ${imp.fileName}: ${error.message}`);
    }
    const payload = buildMatchReportPayload({
      matchId: matchId.get(imp.matchKey)!,
      ownTeamId,
      seasonId: seasonId.get(imp.season) ?? null,
      report: imp.report,
      mappings: imp.mappings.map((m) => ({ ...m, playerId: m.playerId ? playerId.get(m.playerId) ?? null : null })),
      file: { name: imp.fileName, hash: imp.hash, size: imp.size, storagePath },
      source: imp.source,
      issues: imp.issues,
      overwrite: false,
      conflicts: imp.conflicts,
    });
    const { data, error } = await db.rpc("import_match_report", { payload: payload as unknown as Json });
    if (error) {
      if (error.hint === "match_already_imported") {
        results.gia_presenti = (results.gia_presenti ?? 0) + 1;
        continue;
      }
      throw new Error(`Import ${imp.fileName}: ${error.message}`);
    }
    const status = (data as { status: string }).status;
    results[status] = (results[status] ?? 0) + 1;
  }
  console.table(results);

  step("Roster");
  // il ruolo solo dove indicato dalla squadra: le altre righe non toccano quello messo dall'admin
  const rosterRow = (r: Dataset["rosters"][number]) => ({ season_id: seasonId.get(r.season)!, player_id: playerId.get(r.player)!, jersey_number: r.jersey, nickname: r.nickname, source_id: src(r.sourceKey) });
  await upsert(db, "season_rosters", ds.rosters.filter((r) => !r.role).map(rosterRow), "season_id,player_id", update);
  await upsert(db, "season_rosters", ds.rosters.filter((r) => r.role).map((r) => ({ ...rosterRow(r), role: r.role })), "season_id,player_id", update);
  if (update) {
    // righe generate dall'import che non valgono più (es. giocatore solo "assente" nei box score);
    // quelle aggiunte a mano dall'admin (senza fonte o con altra fonte) restano
    const importSources = new Set([src("xls-s"), src("team")].filter(Boolean));
    const wanted = new Set(ds.rosters.map((r) => `${seasonId.get(r.season)}|${playerId.get(r.player)}`));
    const existing = await selectAll<{ season_id: string; player_id: string; source_id: string | null }>(db, "season_rosters", "season_id,player_id,source_id");
    for (const r of existing) {
      if (!r.source_id || !importSources.has(r.source_id) || wanted.has(`${r.season_id}|${r.player_id}`)) continue;
      const { error } = await db.from("season_rosters").delete().eq("season_id", r.season_id).eq("player_id", r.player_id);
      if (error) throw new Error(`Roster: ${error.message}`);
    }
  }

  step("Staff");
  await upsert(db, "staff_members", ds.staff.map((st) => ({ slug: st.slug, first_name: st.first_name, last_name: st.last_name, player_id: st.player ? playerId.get(st.player)! : null, notes: st.notes })), "slug", update);
  const staffId = new Map((await selectAll<{ id: string; slug: string }>(db, "staff_members", "id,slug")).map((r) => [r.slug, r.id]));
  await upsert(db, "season_staff", ds.seasonStaff.map((r) => ({ season_id: seasonId.get(r.season)!, staff_id: staffId.get(r.staff)!, role: r.role, sort_order: r.sort_order, source_id: src(r.sourceKey) })), "season_id,staff_id,role", update);
  if (update) {
    // ruoli cambiati in staff.json (es. da dirigente a statistiche): via la riga vecchia
    const wanted = new Set(ds.seasonStaff.map((r) => `${seasonId.get(r.season)}|${staffId.get(r.staff)}|${r.role}`));
    const existing = await selectAll<{ season_id: string; staff_id: string; role: string; source_id: string | null }>(db, "season_staff", "season_id,staff_id,role,source_id");
    for (const r of existing) {
      if (r.source_id !== src("team") || wanted.has(`${r.season_id}|${r.staff_id}|${r.role}`)) continue;
      const { error } = await db.from("season_staff").delete().eq("season_id", r.season_id).eq("staff_id", r.staff_id).eq("role", r.role);
      if (error) throw new Error(`Staff: ${error.message}`);
    }
  }

  step("Date di nascita (riservate)");
  const profileRow = (p: Dataset["privateProfiles"][number]) => ({ birth_date: p.birth_date, birth_year_known: p.birth_year_known });
  await upsert(db, "private_profiles", ds.privateProfiles.filter((p) => p.kind === "player").map((p) => ({ player_id: playerId.get(p.slug)!, ...profileRow(p) })), "player_id", update);
  await upsert(db, "private_profiles", ds.privateProfiles.filter((p) => p.kind === "staff").map((p) => ({ staff_id: staffId.get(p.slug)!, ...profileRow(p) })), "staff_id", update);

  step("Conflitti tra fonti");
  const conflictRows: TablesInsert<"source_conflicts">[] = ds.conflicts.map((c) => {
    const entityId = c.entity === "match" ? matchId.get(c.ref)! : competitionId.get(c.ref)!;
    return {
      entity_type: c.entity,
      entity_id: entityId,
      match_id: c.entity === "match" ? entityId : null,
      field: c.field,
      primary_source_id: c.primarySource ? src(c.primarySource) : null,
      primary_value: c.primary_value,
      secondary_source_id: src(c.secondarySource),
      secondary_value: c.secondary_value,
      description: c.description,
    };
  });

  // Verifiche post-caricamento: totali di fase e classifica ufficiale vs partite
  const nowConsistent: { entity_id: string; field: string }[] = [];
  const records = await selectAll<{ season_slug: string; competition_slug: string; competition_id: string; played: number; wins: number; losses: number; points_for: number; points_against: number }>(
    db,
    "v_own_competition_records",
    "season_slug,competition_slug,competition_id,played,wins,losses,points_for,points_against",
  );
  for (const t of ds.phaseTotals) {
    const r = records.find((x) => x.season_slug === t.season && x.competition_slug === t.competition);
    if (!r) continue;
    const official = `${t.played} gare, ${t.wins}-${t.losses}, ${t.pf}-${t.pa}`;
    const computed = `${r.played} gare, ${r.wins}-${r.losses}, ${r.points_for}-${r.points_against}`;
    if (official === computed) nowConsistent.push({ entity_id: r.competition_id, field: "own_totals" });
    else {
      conflictRows.push({ entity_type: "competition", entity_id: r.competition_id, field: "own_totals", primary_value: official, primary_source_id: src(t.sourceKey), secondary_value: computed, secondary_source_id: null, description: `Totali Sgreeners della fase secondo il CSI (riportati nell'Excel) diversi dalla somma delle partite. ${t.note ?? ""}`.trim() });
    }
  }
  const officialOwn = ds.standings.filter((s) => s.team === ds.teams.find((t) => t.is_own_team)!.slug);
  for (const s of officialOwn) {
    const r = records.find((x) => x.season_slug === s.season && x.competition_slug === s.competition);
    if (!r) continue;
    const official = `${s.played} gare, ${s.wins}-${s.losses}, ${s.points_for}-${s.points_against}`;
    const computed = `${r.played} gare, ${r.wins}-${r.losses}, ${r.points_for}-${r.points_against}`;
    if (official === computed) nowConsistent.push({ entity_id: r.competition_id, field: "own_row" });
    else {
      conflictRows.push({ entity_type: "standings", entity_id: r.competition_id, field: "own_row", primary_value: official, primary_source_id: src(s.sourceKey), secondary_value: computed, secondary_source_id: null, description: "Riga Bolo Sgreeners della classifica ufficiale diversa dalle partite in archivio" });
    }
  }
  // stessa discrepanza già registrata (es. dalla funzione di import del box score): non duplicarla
  const existing = new Set(
    (await selectAll<{ entity_id: string; field: string; secondary_value: string | null }>(db, "source_conflicts", "entity_id,field,secondary_value")).map(
      (r) => `${r.entity_id}|${r.field}|${r.secondary_value}`,
    ),
  );
  await upsert(db, "source_conflicts", conflictRows.filter((c) => !existing.has(`${c.entity_id}|${c.field}|${c.secondary_value}`)), "entity_type,entity_id,field,secondary_source_id", false);

  // verifiche che, con i dati aggiornati, tornano: si chiudono lasciando traccia
  for (const c of nowConsistent) {
    const { error } = await db
      .from("source_conflicts")
      .update({ status: "resolved", resolution_note: "Verifica ripetuta all'import: ora i totali coincidono con le partite in archivio.", resolved_at: new Date().toISOString() })
      .eq("entity_id", c.entity_id)
      .eq("field", c.field)
      .eq("status", "open");
    if (error) throw new Error(`Chiusura verifica ${c.field}: ${error.message}`);
  }

  // discrepanze verificate e chiuse (data/curated/manual-conflicts.json → resolved)
  for (const r of ds.resolvedConflicts) {
    const id = matchId.get(r.ref);
    if (!id) continue;
    const { error } = await db
      .from("source_conflicts")
      .update({ status: "resolved", resolution_note: r.note, resolved_at: new Date().toISOString() })
      .eq("match_id", id)
      .eq("field", r.field)
      .eq("status", "open");
    if (error) throw new Error(`Chiusura discrepanza ${r.ref}: ${error.message}`);
  }

  const { count } = await db.from("source_conflicts").select("id", { count: "exact", head: true });
  console.log(`\nImport completato. Conflitti registrati nel database: ${count ?? "?"}`);
}

/**
 * Quando il CSI corregge l'avversario di una partita già importata, i totali di squadra e i
 * parziali dell'avversario restano legati alla squadra sbagliata: li sposta su quella giusta.
 */
async function reassignOpponentRows(db: Db, ds: Dataset, matchId: Map<string | null, string>, teamId: Map<string, string>) {
  const teamsOf = new Map(ds.matches.map((m) => [matchId.get(m.key)!, [teamId.get(m.home)!, teamId.get(m.away)!]]));
  const ownId = teamId.get(ds.teams.find((t) => t.is_own_team)!.slug)!;
  for (const table of ["team_match_stats", "match_period_scores"] as const) {
    const rows = await selectAll<{ match_id: string; team_id: string }>(db, table, "match_id,team_id");
    const stale = new Set(rows.filter((r) => teamsOf.has(r.match_id) && !teamsOf.get(r.match_id)!.includes(r.team_id)).map((r) => `${r.match_id}|${r.team_id}`));
    for (const k of stale) {
      const [match, wrongTeam] = k.split("|");
      const opponent = teamsOf.get(match)!.find((t) => t !== ownId)!;
      const { error } = await db.from(table).update({ team_id: opponent }).eq("match_id", match).eq("team_id", wrongTeam);
      if (error) throw new Error(`Correzione avversario in ${table}: ${error.message}`);
    }
    if (stale.size > 0) console.log(`  ${table}: ${stale.size} righe spostate sull'avversario indicato dal CSI`);
  }
}

/** Un soprannome (per stagione) appartiene a una sola squadra: toglie le associazioni superate. */
async function dropStaleTeamAliases(db: Db, ds: Dataset, seasonId: Map<string, string>, teamId: Map<string, string>) {
  const rows = await selectAll<{ id: string; alias_normalized: string; season_id: string | null; team_id: string }>(db, "team_aliases", "id,alias_normalized,season_id,team_id");
  const wanted = new Map(ds.teamAliases.map((a) => [`${normalizeTeamName(a.alias)}|${a.season ? seasonId.get(a.season) : null}`, teamId.get(a.team)]));
  const stale = rows.filter((r) => {
    const team = wanted.get(`${r.alias_normalized}|${r.season_id}`);
    return team !== undefined && team !== r.team_id;
  });
  for (const r of stale) {
    const { error } = await db.from("team_aliases").delete().eq("id", r.id);
    if (error) throw new Error(`Alias squadra: ${error.message}`);
  }
  if (stale.length > 0) console.log(`  team_aliases: ${stale.length} soprannomi riassegnati`);
}
