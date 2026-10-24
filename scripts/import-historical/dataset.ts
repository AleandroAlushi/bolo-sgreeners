/**
 * Tipi del dataset storico. Ogni entità è identificata da una chiave naturale
 * (slug, data, nome file): gli UUID del database vengono risolti solo in persistenza.
 */
import type { ImportIssue, NormalizedMatchReport, PlayerMapping } from "../../src/lib/importers";

export type SourceKind = "html" | "excel" | "csi" | "pdf" | "photo" | "web" | "manual";

export interface SourceDef {
  key: string;
  kind: SourceKind;
  label: string;
  url?: string | null;
  reference_date?: string | null;
  notes?: string | null;
}

export interface MatchDef {
  key: string;
  season: string;
  competition: string;
  round_number: number | null;
  round_label: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  home: string;
  away: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "played";
  home_away_confirmed: boolean;
  csi_match_id: number | null;
  csi_game_code: string | null;
  verification: "verified" | "probable" | "to_verify";
  scheduleSource: string;
  resultSource: string | null;
  notes: string | null;
  /** nome del file HTML associato dall'Excel calendario */
  htmlFile: string | null;
  /** punteggio Sgreeners-avversari secondo l'Excel calendario (solo verifica) */
  excelScore: { own: number; opponent: number } | null;
  excelHomeAway: "home" | "away" | null;
}

export interface StatImportDef {
  matchKey: string;
  season: string;
  kind: "html" | "excel-log";
  fileName: string;
  hash: string | null;
  size: number | null;
  content: string | null;
  report: NormalizedMatchReport;
  /** playerId = slug del giocatore */
  mappings: PlayerMapping[];
  issues: ImportIssue[];
  source: { kind: SourceKind; label: string; notes?: string };
  conflicts: { field: string; primary_value: string | null; secondary_value: string | null; description: string }[];
}

export interface ConflictDef {
  entity: "match" | "competition";
  /** chiave partita oppure "season/competition" */
  ref: string;
  field: string;
  primarySource: string | null;
  primary_value: string | null;
  secondarySource: string | null;
  secondary_value: string | null;
  description: string;
}

export interface Dataset {
  sources: SourceDef[];
  seasons: { slug: string; label: string; is_current: boolean; notes: string | null }[];
  competitions: {
    season: string;
    slug: string;
    name: string;
    kind: string;
    phase_order: number;
    csi_project_id: number | null;
    format_notes: string | null;
    sourceKey: string | null;
  }[];
  rules: {
    season: string;
    competition: string;
    points_win: number;
    points_loss: number;
    points_ot_loss: number | null;
    tiebreakers: string[];
    is_verified: boolean;
    notes: string | null;
    sourceKey: string;
  }[];
  teams: { slug: string; name: string; short_name: string | null; city: string | null; is_own_team: boolean }[];
  teamAliases: { team: string; alias: string; season: string | null; sourceKey: string }[];
  competitionTeams: { season: string; competition: string; team: string; display_name: string; csi_team_id: number | null }[];
  venues: { key: string; name: string; address: string | null; city: string | null }[];
  players: { slug: string; first_name: string; last_name: string; nickname: string | null }[];
  /** caratteristiche indicate dalla squadra (data/curated/roster.json) */
  playerDetails: { player: string; height_cm: number | null; hand: "destro" | "mancino" | null }[];
  /** date di nascita (data/private/profiles.json); senza anno: 2000-mm-gg e birth_year_known false */
  privateProfiles: { kind: "player" | "staff"; slug: string; birth_date: string; birth_year_known: boolean }[];
  playerAliases: { player: string; alias: string; season: string | null; jersey: string | null; sourceKey: string; notes: string | null }[];
  matches: MatchDef[];
  periods: { match: string; team: string; period: number; points: number; sourceKey: string }[];
  standings: {
    season: string;
    competition: string;
    team: string;
    position: number;
    played: number;
    wins: number;
    losses: number;
    ot_losses: number | null;
    points: number;
    points_for: number | null;
    points_against: number | null;
    extra: Record<string, number>;
    /** data della classifica (stagione in corso) */
    asOf: string | null;
    sourceKey: string;
  }[];
  statImports: StatImportDef[];
  rosters: { season: string; player: string; jersey: string | null; nickname: string | null; role: string | null; sourceKey: string }[];
  staff: { slug: string; first_name: string; last_name: string; player: string | null; notes: string | null }[];
  seasonStaff: { season: string; staff: string; role: string; sort_order: number; sourceKey: string }[];
  conflicts: ConflictDef[];
  /** discrepanze dell'analisi chiuse da una fonte più autorevole */
  resolvedConflicts: { ref: string; field: string; note: string }[];
  /** totali ufficiali per fase da confrontare con le partite dopo il caricamento */
  phaseTotals: { season: string; competition: string; played: number; wins: number; losses: number; pf: number; pa: number; sourceKey: string; note: string | null }[];
  log: string[];
}
