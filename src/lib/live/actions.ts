"use server";

/**
 * Partita in diretta (area squadra): avvio, salvataggio del box score a fine partita, eliminazione.
 * Gli eventi li scrive direttamente il browser di chi prende le statistiche (RLS: solo la squadra);
 * qui passano solo le operazioni che toccano più tabelle.
 */
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DATA_TAG } from "@/lib/data/core";
import { buildMatchReportPayload } from "@/lib/importers";
import type { Json } from "@/lib/supabase/database.types";
import { requireTeamSession } from "@/lib/team/auth";
import type { LiveEvent, LiveRosterEntry } from "./engine";
import { buildLiveReport } from "./report";

export async function startLiveGame(fd: FormData) {
  const session = await requireTeamSession();
  if (!session.isMember) redirect("/area-squadra");
  const p = z
    .object({
      match_id: z.string().uuid(),
      periods: z.coerce.number().int().min(1).max(4),
      period_minutes: z.coerce.number().int().min(1).max(30),
    })
    .safeParse({ match_id: fd.get("match_id"), periods: fd.get("periods"), period_minutes: fd.get("period_minutes") });
  if (!p.success) redirect("/area-squadra/live?errore=dati");
  const { supabase, user } = session;
  const existing = await supabase.from("live_games").select("id").eq("match_id", p.data.match_id).maybeSingle();
  if (existing.data) redirect(`/area-squadra/live/${existing.data.id}`);

  // convocati scelti (checkbox "player") con numero e nome da mostrare sui pulsanti
  const chosen = fd.getAll("player").map(String);
  const { data: match } = await supabase.from("v_matches").select("season_id, opponent_name").eq("id", p.data.match_id).single();
  const { data: roster } = await supabase
    .from("v_season_roster")
    .select("player_id, jersey_number, nickname, first_name")
    .eq("season_id", match?.season_id ?? "")
    .in("player_id", chosen.length ? chosen : ["00000000-0000-0000-0000-000000000000"]);
  const entries: LiveRosterEntry[] = (roster ?? [])
    .map((r) => ({ player_id: r.player_id!, jersey: r.jersey_number, name: r.nickname || r.first_name || "?" }))
    .sort((a, b) => Number(a.jersey ?? 999) - Number(b.jersey ?? 999));
  if (entries.length < 5) redirect(`/area-squadra/live?errore=convocati&partita=${p.data.match_id}`);

  const seconds = p.data.period_minutes * 60;
  const { data, error } = await supabase
    .from("live_games")
    .insert({
      match_id: p.data.match_id,
      periods: p.data.periods,
      period_seconds: seconds,
      clock_remaining: seconds,
      roster: entries as unknown as Json,
      opponent_name: match?.opponent_name ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/area-squadra/live?errore=avvio");
  redirect(`/area-squadra/live/${data.id}`);
}

export interface FinalizeResult {
  ok: boolean;
  message: string;
  matchId?: string;
}

/** Fine partita: gli eventi diventano il box score ufficiale (stesso percorso dell'import HTML). */
export async function saveLiveBoxScore(gameId: string): Promise<FinalizeResult> {
  const session = await requireTeamSession();
  if (!session.isMember) return { ok: false, message: "Account non abilitato." };
  const { supabase } = session;
  const { data: game } = await supabase.from("live_games").select("*").eq("id", gameId).single();
  if (!game) return { ok: false, message: "Partita live non trovata." };
  const [{ data: events }, { data: match }, { data: own }] = await Promise.all([
    supabase.from("live_events").select("id, n, period, clock, team, player_id, kind, made").eq("game_id", gameId).order("n"),
    supabase.from("v_matches").select("id, season_id, match_date, opponent_name").eq("id", game.match_id).single(),
    supabase.from("teams").select("id, name").eq("is_own_team", true).single(),
  ]);
  if (!match || !own) return { ok: false, message: "Partita o squadra non trovata." };
  const list = (events ?? []) as LiveEvent[];
  if (!list.some((e) => e.kind !== "in" && e.kind !== "out")) return { ok: false, message: "Non ci sono statistiche da salvare." };

  const { report, mappings } = buildLiveReport(
    { period: game.period, periods: game.periods, period_seconds: game.period_seconds, roster: game.roster as unknown as LiveRosterEntry[], opponent_name: game.opponent_name },
    list,
    { date: match.match_date, ownName: own.name, opponentName: match.opponent_name ?? game.opponent_name ?? "Avversari" },
  );
  const last = list.at(-1)!;
  const payload = buildMatchReportPayload({
    matchId: match.id!,
    ownTeamId: own.id,
    seasonId: match.season_id,
    report,
    mappings,
    // impronta degli eventi: salvare due volte gli stessi eventi non duplica nulla
    file: { name: `Statistiche live ${match.match_date ?? ""}`.trim(), hash: `live-${gameId}-${list.length}-${last.n}`, size: null, storagePath: null },
    source: {
      kind: "manual",
      label: `Statistiche live dal sito · ${match.match_date ? match.match_date.split("-").reverse().join("/") : "data n.d."}`,
    },
    issues: [],
    // la diretta, se usata, è la fonte del box score: sostituisce eventuali statistiche già salvate
    overwrite: true,
  });
  const { error } = await supabase.rpc("import_live_report", { game: gameId, payload: payload as unknown as Json });
  if (error) return { ok: false, message: `Salvataggio non riuscito: ${error.message}` };
  updateTag(DATA_TAG);
  return { ok: true, message: `Box score salvato: ${report.own.score}-${report.opponent.score}.`, matchId: match.id! };
}

/** Elimina una diretta aperta per errore (solo admin). */
export async function deleteLiveGame(fd: FormData) {
  const session = await requireTeamSession();
  if (!session.isAdmin) redirect("/area-squadra/live");
  const id = String(fd.get("id") ?? "");
  await session.supabase.from("live_games").delete().eq("id", id);
  redirect("/area-squadra/live");
}
