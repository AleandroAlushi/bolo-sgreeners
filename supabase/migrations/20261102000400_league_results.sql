-- =============================================================================
-- Risultati del girone, giornata per giornata: tutte le partite della competizione, anche
-- quelle tra le altre squadre, come le mostra il Livescore CSI. Servono a vedere chi ha battuto
-- chi e a capire la classifica senza aprire il sito del CSI.
-- Tabella separata da matches: le partite dei Bolo Sgreeners (box score, statistiche, calendario
-- personale) restano dove sono; qui c'è solo il tabellone del girone, rifatto dal Livescore.
-- La aggiorna `npm run livescore:update` (GitHub Actions, due volte al giorno).
-- =============================================================================

create table public.league_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  csi_match_id integer not null unique,
  csi_game_code text,
  round_number integer,
  round_label text,
  match_date date,
  start_time time,
  home_team_id uuid references public.teams (id) on delete set null,
  away_team_id uuid references public.teams (id) on delete set null,
  -- nomi come sul Livescore: restano anche se la squadra non è (ancora) collegata
  home_name text not null,
  away_name text not null,
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  -- false = risultato non ancora omologato (in corsivo sul Livescore)
  result_approved boolean,
  home_periods integer[],
  away_periods integer[],
  venue_name text,
  updated_at timestamptz not null default now()
);
create index league_results_competition_idx on public.league_results (competition_id, round_number);
create trigger league_results_updated_at before update on public.league_results
  for each row execute function public.set_updated_at();

alter table public.league_results enable row level security;
create policy "league_results_public_read" on public.league_results
  for select to anon, authenticated using (true);
create policy "league_results_admin_write" on public.league_results
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Con nomi brevi e loghi delle squadre (come v_matches) e il segno delle gare dei Bolo Sgreeners
create view public.v_league_results with (security_invoker = true) as
select
  r.id,
  r.competition_id,
  c.season_id,
  s.slug as season_slug,
  c.slug as competition_slug,
  c.name as competition_name,
  c.kind as competition_kind,
  r.csi_match_id,
  r.csi_game_code,
  r.round_number,
  r.round_label,
  r.match_date,
  r.start_time,
  r.home_team_id,
  coalesce(th.short_name, th.name, r.home_name) as home_name,
  coalesce(th.is_own_team, false) as home_is_own,
  th.logo_path as home_team_logo,
  r.away_team_id,
  coalesce(ta.short_name, ta.name, r.away_name) as away_name,
  coalesce(ta.is_own_team, false) as away_is_own,
  ta.logo_path as away_team_logo,
  r.home_score,
  r.away_score,
  r.result_approved,
  r.home_periods,
  r.away_periods,
  r.venue_name
from public.league_results r
join public.competitions c on c.id = r.competition_id
join public.seasons s on s.id = c.season_id
left join public.teams th on th.id = r.home_team_id
left join public.teams ta on ta.id = r.away_team_id;
