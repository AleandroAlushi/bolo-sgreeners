"use server";

/**
 * Import di un box score da admin:
 *   1. analyzeMatchFile: carica il file su Storage (uploads/<hash>.html), lo analizza e
 *      restituisce l'anteprima (dati estratti, mapping giocatori, partite candidate, problemi);
 *   2. confirmMatchImport: rilegge il file da Storage, applica le scelte dell'admin
 *      (partita, associazioni, nuovi alias/giocatori) e salva tutto con import_match_report.
 * Il parser è sempre lo stesso (src/lib/importers), indipendente dal database.
 */
import { createHash } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { dbMessage, slugify } from "@/lib/admin/forms";
import { DATA_TAG } from "@/lib/data/core";
import {
  ExtractionError,
  buildMatchReportPayload,
  hasBlockingIssues,
  mapPlayers,
  normalizePlayerName,
  normalizeTeamName,
  parseMatchHtml,
  validateImportedMatch,
  type ImportIssue,
  type NormalizedMatchReport,
  type PlayerMapping,
} from "@/lib/importers";
import type { Json } from "@/lib/supabase/database.types";

const MAX_FILE_SIZE = 3 * 1024 * 1024;

export interface MatchCandidate {
  id: string;
  label: string;
  date: string | null;
  hasStats: boolean;
  officialScore: { own: number; opponent: number } | null;
  sameDate: boolean;
}

export type AnalyzeResult =
  | { status: "error"; message: string }
  | {
      status: "preview";
      hash: string;
      fileName: string;
      size: number;
      seasonId: string;
      report: NormalizedMatchReport;
      mappings: PlayerMapping[];
      issues: ImportIssue[];
      candidates: MatchCandidate[];
      suggestedMatchId: string | null;
      suggestedOpponentId: string | null;
      duplicateOf: { importId: string; matchId: string | null } | null;
    };

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function ownTeamContext(supabase: Supabase) {
  const { data: own, error } = await supabase.from("teams").select("id, name, short_name").eq("is_own_team", true).single();
  if (error || !own) throw new Error("Squadra Bolo Sgreeners non configurata (teams.is_own_team)");
  const { data: aliases } = await supabase.from("team_aliases").select("alias").eq("team_id", own.id);
  const names = [own.name, own.short_name, ...(aliases ?? []).map((a) => a.alias)].filter((x): x is string => Boolean(x));
  return { ownTeamId: own.id, ownTeamNames: names };
}

async function aliasContext(supabase: Supabase) {
  const [aliases, players] = await Promise.all([
    supabase.from("player_aliases").select("player_id, alias, season_id, jersey_number"),
    supabase.from("players").select("id, first_name, last_name"),
  ]);
  return {
    aliases: (aliases.data ?? []).map((a) => ({ playerId: a.player_id, alias: a.alias, seasonId: a.season_id, jersey: a.jersey_number })),
    players: (players.data ?? []).map((p) => ({ id: p.id, displayName: `${p.first_name} ${p.last_name}` })),
  };
}

async function logFailure(supabase: Supabase, file: { name: string; hash: string | null; size: number }, seasonId: string | null, message: string, userId: string) {
  await supabase.from("imports").insert({
    kind: "match_report",
    status: "failed",
    file_name: file.name,
    file_hash: file.hash,
    file_size: file.size,
    season_id: seasonId,
    error_message: message,
    created_by: userId,
  });
}

export async function analyzeMatchFile(fd: FormData): Promise<AnalyzeResult> {
  const { supabase, user } = await requireAdmin();
  const file = fd.get("file");
  const seasonId = z.string().uuid().safeParse(fd.get("season_id"));
  if (!seasonId.success) return { status: "error", message: "Seleziona la stagione." };
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Seleziona un file HTML." };
  if (!/\.html?$/i.test(file.name)) return { status: "error", message: "Il file deve avere estensione .html" };
  if (file.size > MAX_FILE_SIZE) return { status: "error", message: `File troppo grande (${Math.round(file.size / 1024)} KB, massimo 3 MB).` };

  const content = await file.text();
  const hash = createHash("sha256").update(content).digest("hex");
  let report: NormalizedMatchReport;
  try {
    const { ownTeamNames } = await ownTeamContext(supabase);
    report = parseMatchHtml(content, { ownTeamNames });
  } catch (e) {
    const message = e instanceof ExtractionError ? `HTML non valido: ${e.message}` : e instanceof Error ? e.message : "Errore di analisi";
    await logFailure(supabase, { name: file.name, hash, size: file.size }, seasonId.data, message, user.id);
    return { status: "error", message };
  }

  const { error: upErr } = await supabase.storage
    .from("match-files")
    .upload(`uploads/${hash}.html`, content, { contentType: "text/html; charset=utf-8", upsert: true });
  if (upErr) return { status: "error", message: `Impossibile salvare il file su Storage: ${upErr.message}` };

  const { data: dup } = await supabase.from("imports").select("id, match_id").eq("file_hash", hash).eq("status", "completed").maybeSingle();

  const { aliases, players } = await aliasContext(supabase);
  const mappings = mapPlayers(report.players, aliases, players, seasonId.data);

  // squadra avversaria dagli alias (soprannomi già visti)
  const { data: teamAliases } = await supabase.from("team_aliases").select("team_id, alias_normalized, season_id");
  const oppKey = normalizeTeamName(report.opponent.rawName);
  const suggestedOpponentId =
    (teamAliases ?? []).find((a) => a.alias_normalized === oppKey && (a.season_id === null || a.season_id === seasonId.data))?.team_id ?? null;

  const { data: matches } = await supabase
    .from("v_matches")
    .select("id, match_date, opponent_id, opponent_name, own_score, opponent_score, competition_name, has_box_score, involves_own_team")
    .eq("season_id", seasonId.data)
    .eq("involves_own_team", true)
    .order("match_date");
  const candidates: MatchCandidate[] = (matches ?? []).map((m) => ({
    id: m.id!,
    date: m.match_date,
    label: `${m.match_date ? m.match_date.split("-").reverse().join("/") : "data n.d."} · ${m.opponent_name} · ${m.competition_name}${m.own_score !== null ? ` · ${m.own_score}-${m.opponent_score}` : ""}`,
    hasStats: Boolean(m.has_box_score),
    officialScore: m.own_score !== null && m.opponent_score !== null ? { own: m.own_score, opponent: m.opponent_score } : null,
    sameDate: Boolean(report.date && m.match_date === report.date),
  }));
  const suggested =
    candidates.find((c) => c.sameDate && (!suggestedOpponentId || (matches ?? []).find((m) => m.id === c.id)?.opponent_id === suggestedOpponentId)) ??
    candidates.find((c) => c.sameDate) ??
    null;

  const issues = validateImportedMatch(report, {
    officialScore: suggested?.officialScore ?? null,
    scheduledDate: suggested?.date ?? null,
    mappings,
  });

  return {
    status: "preview",
    hash,
    fileName: file.name,
    size: file.size,
    seasonId: seasonId.data,
    report,
    mappings,
    issues,
    candidates,
    suggestedMatchId: suggested?.id ?? null,
    suggestedOpponentId,
    duplicateOf: dup ? { importId: dup.id, matchId: dup.match_id } : null,
  };
}

const confirmSchema = z.object({
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  fileName: z.string().min(1),
  size: z.number().int().nonnegative(),
  seasonId: z.string().uuid(),
  matchId: z.string().uuid().nullable(),
  newMatch: z
    .object({
      competitionId: z.string().uuid(),
      opponentId: z.string().uuid(),
      ownIsHome: z.boolean(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .nullable(),
  overwrite: z.boolean(),
  /** una voce per riga del report, nello stesso ordine */
  rows: z.array(
    z.object({
      playerId: z.string().uuid().nullable(),
      newPlayer: z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().min(1) }).nullable(),
      saveAlias: z.enum(["none", "always", "season"]),
    }),
  ),
});

export type ConfirmInput = z.infer<typeof confirmSchema>;
export type ConfirmResult = { status: "error"; message: string } | { status: "done"; matchId: string; message: string };

export async function confirmMatchImport(input: ConfirmInput): Promise<ConfirmResult> {
  const { supabase } = await requireAdmin();
  const p = confirmSchema.safeParse(input);
  if (!p.success) return { status: "error", message: "Dati di conferma non validi." };
  const c = p.data;

  const { data: blob, error: dlErr } = await supabase.storage.from("match-files").download(`uploads/${c.hash}.html`);
  if (dlErr || !blob) return { status: "error", message: "File non più disponibile su Storage: ricaricalo." };
  const content = await blob.text();
  const { ownTeamId, ownTeamNames } = await ownTeamContext(supabase);
  const report = parseMatchHtml(content, { ownTeamNames });
  if (c.rows.length !== report.players.length) return { status: "error", message: "Il mapping non corrisponde al file." };

  // partita: esistente o nuova
  let matchId = c.matchId;
  if (!matchId && c.newMatch) {
    const { data: manual } = await supabase
      .from("data_sources")
      .upsert({ source_key: "manual-admin", kind: "manual", label: "Inserimento manuale (admin)" }, { onConflict: "source_key" })
      .select("id")
      .single();
    const { data, error } = await supabase
      .from("matches")
      .insert({
        competition_id: c.newMatch.competitionId,
        match_date: c.newMatch.date,
        home_team_id: c.newMatch.ownIsHome ? ownTeamId : c.newMatch.opponentId,
        away_team_id: c.newMatch.ownIsHome ? c.newMatch.opponentId : ownTeamId,
        status: "scheduled",
        verification: "probable",
        schedule_source_id: manual?.id ?? null,
      })
      .select("id")
      .single();
    if (error) return { status: "error", message: `Creazione partita non riuscita: ${dbMessage(error)}` };
    matchId = data.id;
  }
  if (!matchId) return { status: "error", message: "Seleziona o crea la partita." };

  // giocatori nuovi (solo su richiesta esplicita) e alias
  const mappings: PlayerMapping[] = [];
  for (let i = 0; i < report.players.length; i++) {
    const line = report.players[i];
    const row = c.rows[i];
    let playerId = row.playerId;
    if (!playerId && row.newPlayer) {
      const base = slugify(`${row.newPlayer.firstName} ${row.newPlayer.lastName}`);
      const { data, error } = await supabase
        .from("players")
        .insert({ first_name: row.newPlayer.firstName, last_name: row.newPlayer.lastName, slug: base, nickname: line.name })
        .select("id")
        .single();
      if (error) return { status: "error", message: `Creazione giocatore ${row.newPlayer.firstName} ${row.newPlayer.lastName}: ${dbMessage(error)}` };
      playerId = data.id;
    }
    if (line.participation !== "absent" && !playerId) {
      return { status: "error", message: `Associa il giocatore "${line.rawLabel}" prima di confermare.` };
    }
    if (playerId && row.saveAlias !== "none" && line.name) {
      await supabase.from("player_aliases").upsert(
        {
          player_id: playerId,
          alias: line.name,
          alias_normalized: normalizePlayerName(line.name),
          season_id: row.saveAlias === "season" ? c.seasonId : null,
          jersey_number: null,
        },
        { onConflict: "alias_normalized,season_id,jersey_number,player_id", ignoreDuplicates: true },
      );
    }
    mappings.push({ rawLabel: line.rawLabel, name: line.name, jersey: line.jersey, status: playerId ? "matched" : "unmatched", playerId, candidates: [], reason: "Scelta admin" });
  }

  // roster: chi è sceso in campo entra nel roster di stagione se mancava
  const rosterRows = report.players
    .map((l, i) => ({ l, id: mappings[i].playerId }))
    .filter((x): x is { l: (typeof report.players)[number]; id: string } => x.id !== null)
    .map((x) => ({ season_id: c.seasonId, player_id: x.id, jersey_number: x.l.jersey }));
  if (rosterRows.length) await supabase.from("season_rosters").upsert(rosterRows, { onConflict: "season_id,player_id", ignoreDuplicates: true });

  // il confronto con il risultato ufficiale e la data lo fa import_match_report (conflitti in DB)
  const issues = validateImportedMatch(report, { mappings });
  if (hasBlockingIssues(issues.filter((i) => i.code !== "player_unmatched"))) {
    return { status: "error", message: issues.filter((i) => i.level === "error").map((i) => i.message).join("; ") };
  }

  const payload = buildMatchReportPayload({
    matchId,
    ownTeamId,
    seasonId: c.seasonId,
    report,
    mappings,
    file: { name: c.fileName, hash: c.hash, size: c.size, storagePath: `uploads/${c.hash}.html` },
    source: { kind: "html", label: `Box score Easy Stats · ${report.date ? report.date.split("-").reverse().join("/") : "data n.d."}` },
    issues,
    overwrite: c.overwrite,
  });
  const { data, error } = await supabase.rpc("import_match_report", { payload: payload as unknown as Json });
  if (error) {
    if (error.hint === "match_already_imported") {
      return { status: "error", message: "La partita ha già statistiche importate: spunta “sovrascrivi” per sostituirle." };
    }
    return { status: "error", message: `Salvataggio non riuscito: ${error.message}` };
  }
  updateTag(DATA_TAG);
  const res = data as { status: string; player_lines?: number; conflicts?: number };
  if (res.status === "duplicate") return { status: "done", matchId, message: "Questo file era già stato importato: nessun dato duplicato." };
  return {
    status: "done",
    matchId,
    message: `Import completato: ${res.player_lines} righe giocatore${res.conflicts ? `, ${res.conflicts} discrepanze registrate` : ""}.`,
  };
}
