/**
 * Tipi condivisi dalla pipeline di import.
 *
 * La pipeline è divisa in fasi indipendenti dal database:
 *   estrazione (HTML → RawBoxScore) → normalizzazione (→ NormalizedMatchReport)
 *   → mapping (nomi → giocatori) → validazione → persistenza (RPC Supabase).
 */

/** Chiavi canoniche delle statistiche di base (devono esistere come colonne in player_match_stats). */
export const CORE_STAT_KEYS = [
  "minutes",
  "points",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "oreb",
  "dreb",
  "reb",
  "ast",
  "stl",
  "tov",
  "blk",
  "pf",
  "plus_minus",
] as const;

export type CoreStatKey = (typeof CORE_STAT_KEYS)[number];

/** null = statistica non registrata dalla fonte (diverso da 0). */
export type StatLine = { [K in CoreStatKey]: number | null };

export type IssueLevel = "error" | "warning" | "info";

export interface ImportIssue {
  level: IssueLevel;
  code: string;
  message: string;
  /** riferimento opzionale (es. nome giocatore o colonna) */
  ref?: string;
}

// ---------------------------------------------------------------------------
// Estrazione
// ---------------------------------------------------------------------------

export interface RawTeamHeader {
  name: string;
  score: number | null;
  /** Lato dichiarato dall'app (Easy Stats: "away" a sinistra, "home" a destra). */
  appSide: "away" | "home" | null;
}

export interface RawStatRow {
  label: string;
  cells: string[];
}

export interface RawShot {
  playerRef: string;
  x: number;
  y: number;
  made: boolean;
  period: number;
}

export interface RawBoxScore {
  parser: string;
  parserVersion: string;
  /** variante del formato rilevata (utile per debug e audit) */
  formatVariant: string;
  title: string | null;
  dateText: string | null;
  left: RawTeamHeader;
  right: RawTeamHeader;
  columns: string[];
  playerRows: RawStatRow[];
  /** righe dei totali squadra, nell'ordine in cui compaiono (di solito sinistra, destra) */
  teamRows: RawStatRow[];
  /** punteggi per periodo: label (Q1..Q4, OT1..) → [sinistra, destra] */
  periods: { label: string; left: number; right: number }[];
  /** ID interni dell'app (presenti solo in alcuni export con shot chart) */
  rosterIds: { label: string; id: string }[];
  shots: { left: RawShot[]; right: RawShot[] };
  hasGameFlowImage: boolean;
}

// ---------------------------------------------------------------------------
// Normalizzazione
// ---------------------------------------------------------------------------

export interface NormalizedPlayerLine {
  /** etichetta originale, es. "#32 Chicco" */
  rawLabel: string;
  /** nome senza numero, es. "Chicco" */
  name: string;
  /** numero di maglia come stringa ("0" e "00" sono numeri diversi) */
  jersey: string | null;
  /** played = in campo; dnp = a referto ma non entrato; absent = non a referto ("-") */
  participation: "played" | "dnp" | "absent";
  didPlay: boolean;
  stats: StatLine;
  /** colonne non riconosciute, conservate senza perderle */
  extra: Record<string, string>;
}

export interface NormalizedTeamSide {
  rawName: string;
  score: number | null;
  appSide: "away" | "home" | null;
  totals: StatLine | null;
  isOwnTeam: boolean;
}

export interface NormalizedMatchReport {
  parser: string;
  parserVersion: string;
  formatVariant: string;
  /** ISO yyyy-mm-dd */
  date: string | null;
  own: NormalizedTeamSide;
  opponent: NormalizedTeamSide;
  /** punteggi per periodo dal punto di vista own/opponent */
  periods: { period: number; label: string; own: number; opponent: number }[];
  players: NormalizedPlayerLine[];
  /** statistiche disponibili in questo file */
  availableStats: CoreStatKey[];
  shots: { own: RawShot[]; opponent: RawShot[] };
  rosterIds: { label: string; id: string }[];
  issues: ImportIssue[];
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export interface AliasRecord {
  playerId: string;
  alias: string;
  /** limitato a una stagione (null = valido sempre) */
  seasonId: string | null;
  /** valido solo con questo numero di maglia (null = qualsiasi) */
  jersey: string | null;
}

export interface PlayerRef {
  id: string;
  displayName: string;
}

export type MappingStatus = "matched" | "ambiguous" | "unmatched";

export interface PlayerMapping {
  rawLabel: string;
  name: string;
  jersey: string | null;
  status: MappingStatus;
  playerId: string | null;
  candidates: string[];
  reason: string;
}
