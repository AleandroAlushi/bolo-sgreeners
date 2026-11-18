import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  compareStandings,
  computeStandings,
  isCalendarComplete,
  type OfficialRow,
  type StandingRow,
  type StandingsDiscrepancy,
} from "@/lib/domain/standings";
import type { Tables } from "@/lib/supabase/database.types";
import { DATA_TAG, db, dbReady, unwrap } from "./core";
import { getLeagueResults, getSeasonMatches } from "./matches";

export type StandingsMode = "computed" | "official" | "own-only" | "none";

export interface CompetitionStandings {
  competition: Tables<"competitions">;
  rule: Tables<"standings_rules"> | null;
  mode: StandingsMode;
  rows: (StandingRow & { extra?: Record<string, unknown> })[];
  discrepancies: (StandingsDiscrepancy & { team_name: string })[];
  officialSource: Tables<"data_sources"> | null;
  /** logo (percorso nel bucket media) per squadra */
  logos: Record<string, string>;
  /** nome breve e stabile della squadra (senza sponsor), per gli schermi stretti */
  shortNames: Record<string, string>;
  /** slug della squadra, per il link alla sua scheda */
  slugs: Record<string, string>;
  /** punti fatti/subiti ricalcolati dai risultati (la classifica CSI conta due volte i supplementari) */
  pointsFromResults: boolean;
}

export async function getSeasonStandings(seasonId: string): Promise<CompetitionStandings[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(DATA_TAG);
  if (!dbReady()) return [];
  const client = db();
  const competitions = unwrap(
    await client.from("competitions").select("*").eq("season_id", seasonId).order("phase_order"),
    "le competizioni",
  );
  if (competitions.length === 0) return [];
  const ids = competitions.map((c) => c.id);
  const [rules, official, entries, adjustments, teams, matches, league] = await Promise.all([
    client.from("standings_rules").select("*").in("competition_id", ids),
    client.from("official_standings").select("*").in("competition_id", ids).order("position"),
    client.from("competition_teams").select("*").in("competition_id", ids),
    client.from("standings_adjustments").select("*").in("competition_id", ids),
    client.from("teams").select("id, slug, name, short_name, is_own_team, logo_path"),
    getSeasonMatches(seasonId),
    getLeagueResults(seasonId),
  ]);
  const ruleRows = unwrap(rules, "le regole di classifica");
  const officialRows = unwrap(official, "la classifica ufficiale");
  const entryRows = unwrap(entries, "le squadre partecipanti");
  const adjRows = unwrap(adjustments, "le penalizzazioni");
  const teamRows = unwrap(teams, "le squadre");
  const ownTeamId = teamRows.find((t) => t.is_own_team)?.id ?? null;
  const logos = Object.fromEntries(teamRows.filter((t) => t.logo_path).map((t) => [t.id, t.logo_path!]));
  const shortNames = Object.fromEntries(teamRows.map((t) => [t.id, t.is_own_team ? t.name : (t.short_name ?? t.name)]));
  const slugs = Object.fromEntries(teamRows.map((t) => [t.id, t.slug]));
  const sourceIds = [...new Set(officialRows.map((o) => o.source_id).filter((x): x is string => Boolean(x)))];
  const sources = sourceIds.length ? unwrap(await client.from("data_sources").select("*").in("id", sourceIds), "le fonti") : [];

  return competitions.map((competition) => {
    const rule = ruleRows.find((r) => r.competition_id === competition.id) ?? null;
    const compEntries = entryRows.filter((e) => e.competition_id === competition.id);
    const nameOf = (teamId: string) =>
      compEntries.find((e) => e.team_id === teamId)?.display_name ?? teamRows.find((t) => t.id === teamId)?.name ?? "?";
    const offic: (OfficialRow & { extra: Record<string, unknown>; source_id: string | null })[] = officialRows
      .filter((o) => o.competition_id === competition.id)
      .map((o) => ({ ...o, points: Number(o.points), extra: (o.extra ?? {}) as Record<string, unknown> }));
    const compMatches = matches
      .filter((m) => m.competition_id === competition.id)
      .map((m) => ({
        home_team_id: m.home_team_id!,
        away_team_id: m.away_team_id!,
        home_score: m.home_score,
        away_score: m.away_score,
        status: m.status!,
        periods_recorded: m.periods_recorded,
      }));
    const officialSource = sources.find((s) => s.id === offic[0]?.source_id) ?? null;

    // Punti fatti e subiti dai risultati del girone: la classifica del Livescore CSI, nelle partite
    // finite ai supplementari, somma due volte il punteggio dei tempi regolamentari. Si usano solo
    // se per quella squadra ci sono tutte le partite giocate (stesso numero della classifica).
    const fromResults = new Map<string, { g: number; pf: number; pa: number }>();
    for (const r of league.filter((x) => x.competition_id === competition.id && x.home_score !== null && x.away_score !== null)) {
      for (const [t, f, a] of [
        [r.home_team_id, r.home_score!, r.away_score!],
        [r.away_team_id, r.away_score!, r.home_score!],
      ] as const) {
        if (!t) continue;
        const cur = fromResults.get(t) ?? { g: 0, pf: 0, pa: 0 };
        fromResults.set(t, { g: cur.g + 1, pf: cur.pf + f, pa: cur.pa + a });
      }
    }
    const pfPa = (o: { team_id: string; played: number; points_for: number | null; points_against: number | null }) => {
      const r = fromResults.get(o.team_id);
      return r && r.g === o.played ? { pf: r.pf, pa: r.pa } : { pf: o.points_for ?? 0, pa: o.points_against ?? 0 };
    };
    const pointsFromResults = offic.some((o) => {
      const v = pfPa(o);
      return v.pf !== (o.points_for ?? 0) || v.pa !== (o.points_against ?? 0);
    });

    const officialRowsForUi = () =>
      offic.map((o) => ({
        team_id: o.team_id,
        name: nameOf(o.team_id),
        is_own_team: o.team_id === ownTeamId,
        position: o.position,
        played: o.played,
        wins: o.wins,
        losses: o.losses,
        ot_losses: 0,
        points: o.points,
        points_for: pfPa(o).pf,
        points_against: pfPa(o).pa,
        point_diff: pfPa(o).pf - pfPa(o).pa,
        extra: o.extra,
      }));

    if (!rule) {
      return {
        competition,
        rule,
        mode: offic.length ? "official" : compMatches.length ? "own-only" : "none",
        rows: officialRowsForUi(),
        discrepancies: [],
        officialSource,
        logos,
        shortNames,
        slugs,
        pointsFromResults,
      } satisfies CompetitionStandings;
    }

    const teams = compEntries.map((e) => ({ team_id: e.team_id, name: e.display_name, is_own_team: e.team_id === ownTeamId }));
    const adj = new Map<string, number>();
    for (const a of adjRows.filter((x) => x.competition_id === competition.id)) adj.set(a.team_id, (adj.get(a.team_id) ?? 0) + Number(a.points));
    const computed = computeStandings(
      teams,
      compMatches,
      { ...rule, points_win: Number(rule.points_win), points_loss: Number(rule.points_loss), points_ot_win: rule.points_ot_win === null ? null : Number(rule.points_ot_win), points_ot_loss: rule.points_ot_loss === null ? null : Number(rule.points_ot_loss), points_forfeit_win: rule.points_forfeit_win === null ? null : Number(rule.points_forfeit_win), points_forfeit_loss: rule.points_forfeit_loss === null ? null : Number(rule.points_forfeit_loss) },
      adj,
    );
    const complete = isCalendarComplete(computed, offic, compMatches, ownTeamId);
    if (complete) {
      return {
        competition,
        rule,
        mode: "computed",
        rows: computed,
        discrepancies: compareStandings(computed, offic).map((d) => ({ ...d, team_name: nameOf(d.team_id) })),
        officialSource,
        logos,
        shortNames,
        slugs,
        pointsFromResults: false,
      } satisfies CompetitionStandings;
    }
    return {
      competition,
      rule,
      mode: offic.length ? "official" : "own-only",
      rows: officialRowsForUi(),
      discrepancies: [],
      officialSource,
      logos,
      shortNames,
      slugs,
      pointsFromResults,
    } satisfies CompetitionStandings;
  });
}
