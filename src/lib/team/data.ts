import "server-only";
import type { PastePerson, TrainingSetup } from "@/lib/domain/paste";
import type { createSessionClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSessionClient>>;

export interface TeamPerson extends PastePerson {
  /** soprannome (o nome) per il calendario: "Auguri Teo" */
  short: string;
  playerSlug: string | null;
  role: string | null;
}

/** Partita della stagione per il calendario della squadra. */
export interface TeamMatch {
  id: string;
  date: string;
  /** "hh:mm", null se non ancora fissato */
  time: string | null;
  opponent: string;
  home: boolean;
  venue: string | null;
}

/** Orari degli allenamenti per giorno ISO ("1" = lunedì): ["22:00", "23:30"]. */
export type TrainingTimes = Record<string, [string, string]>;
const DEFAULT_TIMES: TrainingTimes = { "1": ["22:00", "23:30"], "4": ["21:30", "23:00"] };

/**
 * Dati dell'area squadra per la stagione in corso, letti con la sessione dell'utente: se non è
 * della squadra la RLS non restituisce date di nascita né allenamenti.
 */
export async function getTeamArea(supabase: Client) {
  const { data: seasons } = await supabase.from("seasons").select("id, slug, label, is_current").order("slug", { ascending: false });
  const season = (seasons ?? []).find((s) => s.is_current) ?? seasons?.[0] ?? null;
  if (!season) return null;
  // a inizio stagione il roster si riempie con i box score: fino ad allora vale quello precedente
  const rosterQuery = (seasonId: string) =>
    supabase.from("v_season_roster").select("player_id, player_slug, first_name, last_name, nickname").eq("season_id", seasonId);
  const [roster0, staff, staffNames, profiles, schedule, breaks, matches] = await Promise.all([
    rosterQuery(season.id),
    supabase.from("v_season_staff").select("staff_id, player_id, player_slug, first_name, last_name, role").eq("season_id", season.id),
    supabase.from("staff_members").select("id, nickname"),
    supabase.from("private_profiles").select("player_id, staff_id, birth_date, paste_day, paste_exempt, paste_done_season"),
    supabase.from("training_schedule").select("*").eq("season_id", season.id).maybeSingle(),
    supabase.from("training_breaks").select("*").eq("season_id", season.id).order("start_date"),
    // nei giorni di partita (casa o trasferta) non ci si allena
    supabase
      .from("v_matches")
      .select("id, match_date, start_time, opponent_name, own_side, venue_name")
      .eq("season_id", season.id)
      .eq("involves_own_team", true)
      .neq("status", "cancelled")
      .order("match_date"),
  ]);
  let roster = roster0;
  let rosterFrom: string | null = null;
  if ((roster.data ?? []).length === 0) {
    const previous = (seasons ?? []).find((s) => s.slug < season.slug);
    if (previous) {
      roster = await rosterQuery(previous.id);
      rosterFrom = previous.slug;
    }
  }
  const profile = (playerId: string | null, staffId: string | null) =>
    (profiles.data ?? []).find((p) => (playerId && p.player_id === playerId) || (staffId && p.staff_id === staffId));
  const birth = (playerId: string | null, staffId: string | null) => profile(playerId, staffId)?.birth_date ?? null;
  const exempt = (playerId: string | null, staffId: string | null) => profile(playerId, staffId)?.paste_exempt ?? false;
  const pasteDay = (playerId: string | null, staffId: string | null) => profile(playerId, staffId)?.paste_day ?? null;
  const done = (playerId: string | null, staffId: string | null) => profile(playerId, staffId)?.paste_done_season === season.slug;
  const staffNick = (staffId: string | null) => (staffNames.data ?? []).find((x) => x.id === staffId)?.nickname ?? null;

  const people = new Map<string, TeamPerson>();
  for (const r of roster.data ?? []) {
    people.set(`p:${r.player_id}`, {
      id: `p:${r.player_id}`,
      name: `${r.first_name} ${r.last_name}`,
      birthDate: birth(r.player_id, null),
      exempt: exempt(r.player_id, null),
      pasteDay: pasteDay(r.player_id, null),
      done: done(r.player_id, null),
      short: r.nickname ?? r.first_name ?? "",
      playerSlug: r.player_slug,
      role: null,
    });
  }
  for (const s of staff.data ?? []) {
    const key = s.player_id ? `p:${s.player_id}` : `s:${s.staff_id}`;
    const existing = people.get(key);
    if (existing) {
      existing.role = existing.role ? `${existing.role}, ${s.role}` : s.role;
      continue;
    }
    people.set(key, {
      id: key,
      name: `${s.first_name} ${s.last_name}`,
      birthDate: birth(s.player_id, s.staff_id),
      exempt: exempt(s.player_id, s.staff_id),
      pasteDay: pasteDay(s.player_id, s.staff_id),
      done: done(s.player_id, s.staff_id),
      short: staffNick(s.staff_id) ?? s.first_name ?? "",
      playerSlug: s.player_slug,
      role: s.role,
    });
  }

  // senza date impostate dall'admin: da settembre a maggio, lunedì e giovedì
  const year = Number(season.slug.slice(0, 4));
  const setup: TrainingSetup = {
    start: schedule.data?.start_date ?? `${year}-09-01`,
    end: schedule.data?.end_date ?? `${year + 1}-05-31`,
    weekdays: schedule.data?.weekdays ?? [1, 4],
    breaks: (breaks.data ?? []).map((b) => ({ start: b.start_date, end: b.end_date, label: b.label })),
    matchDays: [...new Set((matches.data ?? []).map((m) => m.match_date).filter((d): d is string => Boolean(d)))],
  };
  const teamMatches: TeamMatch[] = (matches.data ?? [])
    .filter((m) => m.match_date)
    .map((m) => ({
      id: m.id!,
      date: m.match_date!,
      time: m.start_time ? m.start_time.slice(0, 5) : null,
      opponent: m.opponent_name ?? "Avversari",
      home: m.own_side === "home",
      venue: m.venue_name,
    }));
  const times = { ...DEFAULT_TIMES, ...((schedule.data?.times ?? {}) as TrainingTimes) };
  return {
    season,
    matches: teamMatches,
    times,
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    setup,
    breaks: breaks.data ?? [],
    defaultSchedule: !schedule.data,
    /** stagione da cui è preso il roster, se quello della stagione in corso è ancora vuoto */
    rosterFrom,
  };
}
