/**
 * Calcolo della classifica dalle partite secondo la configurazione della competizione
 * (standings_rules) e confronto con la classifica ufficiale CSI salvata.
 * Funzioni pure: nessun accesso al database.
 */

export interface StandingsRule {
  points_win: number;
  points_loss: number;
  points_ot_win: number | null;
  points_ot_loss: number | null;
  points_forfeit_win: number | null;
  points_forfeit_loss: number | null;
  tiebreakers: string[];
}

export interface StandingsMatch {
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  /** numero di periodi registrati (>4 = supplementari); null se ignoto */
  periods_recorded: number | null;
}

export interface StandingsTeam {
  team_id: string;
  name: string;
  is_own_team: boolean;
}

export interface StandingRow extends StandingsTeam {
  position: number;
  played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  points_for: number;
  points_against: number;
  point_diff: number;
}

type Acc = Omit<StandingRow, "position" | "point_diff">;

function pointsFor(rule: StandingsRule, won: boolean, ot: boolean, forfeit: boolean): number {
  if (forfeit) return won ? (rule.points_forfeit_win ?? rule.points_win) : (rule.points_forfeit_loss ?? rule.points_loss);
  if (ot) return won ? (rule.points_ot_win ?? rule.points_win) : (rule.points_ot_loss ?? rule.points_loss);
  return won ? rule.points_win : rule.points_loss;
}

function accumulate(teams: StandingsTeam[], matches: StandingsMatch[], rule: StandingsRule, adjustments: Map<string, number>): Map<string, Acc> {
  const table = new Map<string, Acc>(
    teams.map((t) => [t.team_id, { ...t, played: 0, wins: 0, losses: 0, ot_losses: 0, points: adjustments.get(t.team_id) ?? 0, points_for: 0, points_against: 0 }]),
  );
  for (const m of matches) {
    if (!["played", "forfeit"].includes(m.status) || m.home_score === null || m.away_score === null) continue;
    const home = table.get(m.home_team_id);
    const away = table.get(m.away_team_id);
    if (!home || !away || m.home_score === m.away_score) continue;
    const ot = (m.periods_recorded ?? 4) > 4;
    const forfeit = m.status === "forfeit";
    const homeWon = m.home_score > m.away_score;
    for (const [acc, won, pf, pa] of [
      [home, homeWon, m.home_score, m.away_score],
      [away, !homeWon, m.away_score, m.home_score],
    ] as const) {
      acc.played += 1;
      acc.points_for += pf;
      acc.points_against += pa;
      if (won) acc.wins += 1;
      else {
        acc.losses += 1;
        if (ot) acc.ot_losses += 1;
      }
      acc.points += pointsFor(rule, won, ot, forfeit);
    }
  }
  return table;
}

type Criterion = (group: Acc[], all: StandingsMatch[], rule: StandingsRule) => Map<string, number>;

const simple = (f: (a: Acc) => number): Criterion => (group) => new Map(group.map((a) => [a.team_id, f(a)]));

const CRITERIA: Record<string, Criterion> = {
  points: simple((a) => a.points),
  wins: simple((a) => a.wins),
  point_diff: simple((a) => a.points_for - a.points_against),
  points_for: simple((a) => a.points_for),
  point_quotient: simple((a) => (a.points_against ? a.points_for / a.points_against : 0)),
  // quoziente usato dal CSI: punti/partite + punti fatti/punti subiti
  quotient_total: simple((a) => (a.played ? a.points / a.played : 0) + (a.points_against ? a.points_for / a.points_against : 0)),
  // classifica avulsa tra le sole squadre a pari merito
  head_to_head: (group, all, rule) => {
    const ids = new Set(group.map((g) => g.team_id));
    const mini = accumulate(
      group.map((g) => ({ team_id: g.team_id, name: g.name, is_own_team: g.is_own_team })),
      all.filter((m) => ids.has(m.home_team_id) && ids.has(m.away_team_id)),
      rule,
      new Map(),
    );
    return new Map([...mini.values()].map((a) => [a.team_id, a.points * 10000 + (a.points_for - a.points_against)]));
  },
};

function rank(group: Acc[], criteria: string[], all: StandingsMatch[], rule: StandingsRule): Acc[] {
  if (group.length <= 1 || criteria.length === 0) return [...group].sort((a, b) => a.name.localeCompare(b.name, "it"));
  const [first, ...rest] = criteria;
  const crit = CRITERIA[first];
  if (!crit) return rank(group, rest, all, rule);
  const values = crit(group, all, rule);
  const buckets = new Map<number, Acc[]>();
  for (const a of group) {
    const v = Math.round((values.get(a.team_id) ?? 0) * 1e6) / 1e6;
    buckets.set(v, [...(buckets.get(v) ?? []), a]);
  }
  return [...buckets.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, g]) => rank(g, rest, all, rule));
}

export function computeStandings(
  teams: StandingsTeam[],
  matches: StandingsMatch[],
  rule: StandingsRule,
  adjustments: Map<string, number> = new Map(),
): StandingRow[] {
  const table = accumulate(teams, matches, rule, adjustments);
  const criteria = rule.tiebreakers.includes("points") ? rule.tiebreakers : ["points", ...rule.tiebreakers];
  return rank([...table.values()], criteria, matches, rule).map((a, i) => ({
    ...a,
    position: i + 1,
    point_diff: a.points_for - a.points_against,
  }));
}

export interface OfficialRow {
  team_id: string;
  position: number;
  played: number;
  wins: number;
  losses: number;
  points: number;
  points_for: number | null;
  points_against: number | null;
}

export interface StandingsDiscrepancy {
  team_id: string;
  field: string;
  official: number | null;
  computed: number | null;
}

/** Differenze tra classifica calcolata e ufficiale: vanno mostrate, mai "aggiustate". */
export function compareStandings(computed: StandingRow[], official: OfficialRow[]): StandingsDiscrepancy[] {
  const out: StandingsDiscrepancy[] = [];
  for (const o of official) {
    const c = computed.find((r) => r.team_id === o.team_id);
    const fields: [string, number | null, number | null][] = [
      ["position", o.position, c?.position ?? null],
      ["played", o.played, c?.played ?? null],
      ["wins", o.wins, c?.wins ?? null],
      ["losses", o.losses, c?.losses ?? null],
      ["points", o.points, c?.points ?? null],
      ["points_for", o.points_for, c?.points_for ?? null],
      ["points_against", o.points_against, c?.points_against ?? null],
    ];
    for (const [field, a, b] of fields) if (a !== null && a !== b) out.push({ team_id: o.team_id, field, official: a, computed: b });
  }
  return out;
}

/**
 * La classifica calcolata è affidabile solo se nel database ci sono tutte le partite:
 * con una classifica ufficiale si confrontano le partite giocate, altrimenti serve almeno
 * una partita tra due squadre avversarie (segno che il calendario completo è stato importato).
 */
export function isCalendarComplete(computed: StandingRow[], official: OfficialRow[], matches: StandingsMatch[], ownTeamId: string | null): boolean {
  if (computed.length === 0) return false;
  if (official.length > 0) return official.every((o) => computed.find((c) => c.team_id === o.team_id)?.played === o.played);
  return matches.some((m) => m.home_team_id !== ownTeamId && m.away_team_id !== ownTeamId && m.status === "played");
}
