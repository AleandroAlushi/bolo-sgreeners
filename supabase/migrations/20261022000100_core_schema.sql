-- =============================================================================
-- Bolo Sgreeners — schema principale
-- Tutti i dati che possono cambiare vivono qui; il frontend legge solo dal database.
-- Le statistiche aggregate NON sono salvate: si calcolano nelle view (migration 0300),
-- con l'unica eccezione di player_season_aggregates (storico senza dettaglio partita).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipi enumerati (estendibili con ALTER TYPE ... ADD VALUE)
-- ---------------------------------------------------------------------------
create type public.competition_kind as enum ('regular_season', 'poule', 'playoff', 'cup', 'friendly', 'other');
-- forfeit = partita assegnata a tavolino
create type public.match_status as enum ('scheduled', 'played', 'postponed', 'cancelled', 'forfeit');
create type public.source_kind as enum ('html', 'excel', 'csi', 'livescore', 'instagram', 'pdf', 'photo', 'web', 'manual');
create type public.verification_status as enum ('verified', 'probable', 'to_verify');
-- played = in campo; dnp = a referto ma 0 minuti. Gli assenti non vengono salvati.
create type public.participation as enum ('played', 'dnp');
create type public.import_status as enum ('pending', 'completed', 'failed', 'superseded', 'duplicate');
create type public.conflict_status as enum ('open', 'acknowledged', 'resolved');
create type public.app_role as enum ('admin');

-- ---------------------------------------------------------------------------
-- Utility: updated_at automatico
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Provenienza dei dati
-- ---------------------------------------------------------------------------
-- Una riga per ogni documento/fonte da cui arrivano dati (un file HTML, un foglio Excel,
-- una pagina CSI...). L'etichetta è pubblica e neutra; i nomi file originali stanno in
-- imports (visibile solo agli admin).
create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  kind public.source_kind not null,
  label text not null,
  url text,
  reference_date date,
  -- chiave naturale per rendere idempotenti gli import (es. 'xls-s:2023-24:log')
  source_key text unique,
  notes text,
  created_at timestamptz not null default now()
);
create index data_sources_kind_idx on public.data_sources (kind);

-- ---------------------------------------------------------------------------
-- Stagioni, squadre, competizioni
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[0-9]{4}-[0-9]{2}$'),
  label text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create unique index seasons_single_current_idx on public.seasons (is_current) where is_current;
create trigger seasons_updated_at before update on public.seasons
  for each row execute function public.set_updated_at();

-- Una società/squadra con identità stabile nel tempo. Il nome ufficiale di ogni stagione
-- (che cambia con gli sponsor) sta in competition_teams.display_name.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  short_name text,
  city text,
  is_own_team boolean not null default false,
  logo_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index teams_single_own_idx on public.teams (is_own_team) where is_own_team;
create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

-- Nomi alternativi delle squadre trovati nei file (soprannomi negli HTML, varianti CSI).
-- Riservati agli admin: i soprannomi degli avversari non sono pubblici.
create table public.team_aliases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  alias text not null,
  alias_normalized text not null,
  season_id uuid references public.seasons (id) on delete cascade,
  source_id uuid references public.data_sources (id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (alias_normalized, season_id, team_id)
);
create index team_aliases_lookup_idx on public.team_aliases (alias_normalized);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  short_name text,
  kind public.competition_kind not null,
  -- ordine delle fasi nella stagione (1 = regular season, 2 = poule, ...)
  phase_order integer not null default 1,
  csi_project_id integer,
  format_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, slug)
);
create index competitions_season_idx on public.competitions (season_id);
create trigger competitions_updated_at before update on public.competitions
  for each row execute function public.set_updated_at();

-- Partecipanti di una competizione con il nome ufficiale usato in quella fase.
create table public.competition_teams (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  display_name text not null,
  csi_team_id integer,
  group_label text,
  primary key (competition_id, team_id)
);
create index competition_teams_team_idx on public.competition_teams (team_id);

-- Regole di classifica per competizione: nessun default "inventato", ogni competizione
-- va configurata (e marcata verificata quando confermata sulle fonti CSI).
create table public.standings_rules (
  competition_id uuid primary key references public.competitions (id) on delete cascade,
  points_win numeric(4, 1) not null,
  points_loss numeric(4, 1) not null,
  -- null = stesso valore della vittoria/sconfitta regolamentare
  points_ot_win numeric(4, 1),
  points_ot_loss numeric(4, 1),
  points_forfeit_win numeric(4, 1),
  points_forfeit_loss numeric(4, 1),
  -- criteri di ordinamento in ordine di applicazione
  -- valori ammessi: points, head_to_head, quotient_total, point_quotient, point_diff, points_for, wins
  tiebreakers text[] not null default array['points'],
  is_verified boolean not null default false,
  source_id uuid references public.data_sources (id) on delete set null,
  notes text,
  updated_at timestamptz not null default now(),
  check (tiebreakers <@ array['points', 'head_to_head', 'quotient_total', 'point_quotient', 'point_diff', 'points_for', 'wins'])
);
create trigger standings_rules_updated_at before update on public.standings_rules
  for each row execute function public.set_updated_at();

-- Penalizzazioni / correzioni di punti in classifica.
create table public.standings_adjustments (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  points numeric(4, 1) not null,
  reason text not null,
  source_id uuid references public.data_sources (id) on delete set null,
  created_at timestamptz not null default now()
);
create index standings_adjustments_comp_idx on public.standings_adjustments (competition_id);

-- Classifica ufficiale CSI salvata così com'è (riferimento e fallback quando mancano partite).
create table public.official_standings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  position integer not null check (position > 0),
  played integer not null check (played >= 0),
  wins integer not null check (wins >= 0),
  losses integer not null check (losses >= 0),
  ot_losses integer check (ot_losses >= 0),
  points numeric(5, 1) not null,
  points_for integer,
  points_against integer,
  -- colonne aggiuntive del CSI (es. quoziente canestri) senza cambiare lo schema
  extra jsonb not null default '{}'::jsonb,
  as_of date,
  source_id uuid references public.data_sources (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (competition_id, team_id)
);

-- ---------------------------------------------------------------------------
-- Palestre e partite
-- ---------------------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  notes text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (name, address)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete restrict,
  round_number integer check (round_number > 0),
  round_label text,
  match_date date,
  start_time time,
  venue_id uuid references public.venues (id) on delete set null,
  home_team_id uuid not null references public.teams (id) on delete restrict,
  away_team_id uuid not null references public.teams (id) on delete restrict,
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  status public.match_status not null default 'scheduled',
  -- false quando la fonte non dice chi giocava in casa (es. gara ricavata da totali)
  home_away_confirmed boolean not null default true,
  csi_match_id integer unique,
  csi_game_code text,
  -- affidabilità dell'identificazione (es. avversario dedotto da un soprannome)
  verification public.verification_status not null default 'verified',
  schedule_source_id uuid references public.data_sources (id) on delete set null,
  result_source_id uuid references public.data_sources (id) on delete set null,
  -- chiave naturale per import idempotenti
  import_key text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (status not in ('played', 'forfeit') or (home_score is not null and away_score is not null))
);
create index matches_competition_idx on public.matches (competition_id);
create index matches_date_idx on public.matches (match_date);
create index matches_home_idx on public.matches (home_team_id);
create index matches_away_idx on public.matches (away_team_id);
create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

-- Punti per periodo: 1-4 quarti, 5+ supplementari.
create table public.match_period_scores (
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  period smallint not null check (period between 1 and 12),
  points integer not null check (points >= 0),
  source_id uuid references public.data_sources (id) on delete set null,
  primary key (match_id, team_id, period)
);

-- ---------------------------------------------------------------------------
-- Giocatori
-- ---------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  first_name text not null,
  last_name text not null,
  display_name text generated always as (first_name || ' ' || last_name) stored,
  nickname text,
  photo_path text,
  bio text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger players_updated_at before update on public.players
  for each row execute function public.set_updated_at();

-- Alias con cui un giocatore compare nei file. Può valere solo per una stagione e/o
-- per un numero di maglia (alias ambigui come "Chicco").
create table public.player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  alias text not null,
  alias_normalized text not null,
  season_id uuid references public.seasons (id) on delete cascade,
  jersey_number text check (jersey_number ~ '^[0-9]{1,3}$'),
  source_id uuid references public.data_sources (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (alias_normalized, season_id, jersey_number, player_id)
);
create index player_aliases_lookup_idx on public.player_aliases (alias_normalized);
create index player_aliases_player_idx on public.player_aliases (player_id);

-- Appartenenza di un giocatore al roster di una stagione: numero, ruolo e soprannome
-- sono per stagione perché possono cambiare.
create table public.season_rosters (
  season_id uuid not null references public.seasons (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  jersey_number text check (jersey_number ~ '^[0-9]{1,3}$'),
  role text,
  nickname text,
  is_active boolean not null default true,
  is_captain boolean not null default false,
  notes text,
  source_id uuid references public.data_sources (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);
create index season_rosters_player_idx on public.season_rosters (player_id);
create trigger season_rosters_updated_at before update on public.season_rosters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Import (audit) — riservato agli admin
-- ---------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('match_report', 'excel', 'csi', 'manual', 'historical')),
  status public.import_status not null default 'pending',
  file_name text,
  file_hash text,
  file_size integer check (file_size >= 0),
  storage_path text,
  parser text,
  parser_version text,
  season_id uuid references public.seasons (id) on delete set null,
  match_id uuid references public.matches (id) on delete set null,
  source_id uuid references public.data_sources (id) on delete set null,
  -- output completo del parser (inclusi shot chart e righe non salvate altrove)
  parsed_payload jsonb,
  issues jsonb not null default '[]'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index imports_match_idx on public.imports (match_id);
create index imports_hash_idx on public.imports (file_hash);
-- lo stesso file non può risultare importato con successo due volte
create unique index imports_completed_hash_idx on public.imports (file_hash)
  where status = 'completed' and file_hash is not null;

-- ---------------------------------------------------------------------------
-- Statistiche partita
-- ---------------------------------------------------------------------------
-- Colonne tipizzate per le statistiche "classiche" + extra jsonb per quelle future.
-- null = non registrata dalla fonte (diverso da 0). Vedi docs/ARCHITETTURA.md.
create table public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  -- null solo per righe non attribuibili a un giocatore (es. "Chicco" senza numero)
  player_id uuid references public.players (id) on delete restrict,
  raw_name text,
  jersey_number text check (jersey_number ~ '^[0-9]{1,3}$'),
  participation public.participation not null default 'played',
  is_starter boolean,
  minutes numeric(5, 2) check (minutes >= 0),
  points integer check (points >= 0),
  fgm integer check (fgm >= 0),
  fga integer check (fga >= 0),
  fg3m integer check (fg3m >= 0),
  fg3a integer check (fg3a >= 0),
  ftm integer check (ftm >= 0),
  fta integer check (fta >= 0),
  oreb integer check (oreb >= 0),
  dreb integer check (dreb >= 0),
  reb integer check (reb >= 0),
  ast integer check (ast >= 0),
  stl integer check (stl >= 0),
  tov integer check (tov >= 0),
  blk integer check (blk >= 0),
  pf integer check (pf >= 0),
  plus_minus integer,
  extra jsonb not null default '{}'::jsonb,
  source_id uuid not null references public.data_sources (id) on delete restrict,
  import_id uuid references public.imports (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_id is not null or raw_name is not null),
  check (fgm is null or fga is null or fgm <= fga),
  check (fg3m is null or fg3a is null or fg3m <= fg3a),
  check (fg3m is null or fgm is null or fg3m <= fgm),
  check (ftm is null or fta is null or ftm <= fta),
  check (reb is null or oreb is null or dreb is null or reb = oreb + dreb)
);
create unique index player_match_stats_unique_player_idx
  on public.player_match_stats (match_id, player_id) where player_id is not null;
create index player_match_stats_player_idx on public.player_match_stats (player_id);
create index player_match_stats_match_idx on public.player_match_stats (match_id);
create index player_match_stats_import_idx on public.player_match_stats (import_id);
create trigger player_match_stats_updated_at before update on public.player_match_stats
  for each row execute function public.set_updated_at();

create table public.team_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  points integer check (points >= 0),
  fgm integer check (fgm >= 0),
  fga integer check (fga >= 0),
  fg3m integer check (fg3m >= 0),
  fg3a integer check (fg3a >= 0),
  ftm integer check (ftm >= 0),
  fta integer check (fta >= 0),
  oreb integer check (oreb >= 0),
  dreb integer check (dreb >= 0),
  reb integer check (reb >= 0),
  ast integer check (ast >= 0),
  stl integer check (stl >= 0),
  tov integer check (tov >= 0),
  blk integer check (blk >= 0),
  pf integer check (pf >= 0),
  extra jsonb not null default '{}'::jsonb,
  source_id uuid not null references public.data_sources (id) on delete restrict,
  import_id uuid references public.imports (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (match_id, team_id),
  check (reb is null or oreb is null or dreb is null or reb = oreb + dreb)
);

-- Aggregati storici senza dettaglio partita (es. Excel con soli totali stagionali).
-- Unica eccezione alla regola "niente aggregati salvati": vengono mostrati come tali
-- (basis = 'historical_aggregate') e sommati alla carriera senza confondersi con i dati partita.
create table public.player_season_aggregates (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  competition_id uuid references public.competitions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  games integer not null check (games >= 0),
  minutes numeric(7, 2),
  points integer,
  fgm integer,
  fga integer,
  fg3m integer,
  fg3a integer,
  ftm integer,
  fta integer,
  oreb integer,
  dreb integer,
  reb integer,
  ast integer,
  stl integer,
  tov integer,
  blk integer,
  pf integer,
  source_id uuid not null references public.data_sources (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (season_id, competition_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Conflitti tra fonti — mai risolti in silenzio
-- ---------------------------------------------------------------------------
create table public.source_conflicts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('match', 'player_match_stats', 'team_match_stats', 'competition', 'standings', 'player', 'season')),
  entity_id uuid not null,
  match_id uuid references public.matches (id) on delete cascade,
  field text not null,
  primary_source_id uuid references public.data_sources (id) on delete set null,
  primary_value text,
  secondary_source_id uuid references public.data_sources (id) on delete set null,
  secondary_value text,
  description text not null,
  status public.conflict_status not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique nulls not distinct (entity_type, entity_id, field, secondary_source_id)
);
create index source_conflicts_status_idx on public.source_conflicts (status);
create index source_conflicts_match_idx on public.source_conflicts (match_id);

-- ---------------------------------------------------------------------------
-- Ruoli applicativi
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);
