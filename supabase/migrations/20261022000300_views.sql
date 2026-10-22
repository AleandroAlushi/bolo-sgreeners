-- =============================================================================
-- View di lettura e aggregazione. Unica fonte di verità: le tabelle base.
-- Tutte le view usano security_invoker, quindi rispettano la RLS del chiamante.
-- Se in futuro servirà più velocità basterà trasformare le view dei totali in
-- materialized view con refresh dopo ogni import.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Partite con nomi, stagione, competizione e punto di vista Bolo Sgreeners
-- ---------------------------------------------------------------------------
create view public.v_matches with (security_invoker = true) as
select
  m.id,
  m.competition_id,
  c.season_id,
  s.slug as season_slug,
  s.label as season_label,
  c.slug as competition_slug,
  c.name as competition_name,
  c.short_name as competition_short_name,
  c.kind as competition_kind,
  c.phase_order,
  m.round_number,
  m.round_label,
  m.match_date,
  m.start_time,
  m.status,
  m.home_team_id,
  coalesce(cth.display_name, th.name) as home_team_name,
  th.slug as home_team_slug,
  th.is_own_team as home_is_own,
  m.away_team_id,
  coalesce(cta.display_name, ta.name) as away_team_name,
  ta.slug as away_team_slug,
  ta.is_own_team as away_is_own,
  m.home_score,
  m.away_score,
  m.home_away_confirmed,
  m.verification,
  m.csi_match_id,
  m.csi_game_code,
  m.notes,
  m.venue_id,
  v.name as venue_name,
  v.address as venue_address,
  v.city as venue_city,
  m.schedule_source_id,
  m.result_source_id,
  (th.is_own_team or ta.is_own_team) as involves_own_team,
  case when th.is_own_team then 'home' when ta.is_own_team then 'away' end as own_side,
  case when th.is_own_team then m.home_score when ta.is_own_team then m.away_score end as own_score,
  case when th.is_own_team then m.away_score when ta.is_own_team then m.home_score end as opponent_score,
  case when th.is_own_team then ta.id when ta.is_own_team then th.id end as opponent_id,
  case when th.is_own_team then coalesce(cta.display_name, ta.name)
       when ta.is_own_team then coalesce(cth.display_name, th.name) end as opponent_name,
  case when th.is_own_team then ta.slug when ta.is_own_team then th.slug end as opponent_slug,
  case
    when m.status not in ('played', 'forfeit') or not (th.is_own_team or ta.is_own_team) then null
    when (case when th.is_own_team then m.home_score - m.away_score else m.away_score - m.home_score end) > 0 then 'W'
    when (case when th.is_own_team then m.home_score - m.away_score else m.away_score - m.home_score end) < 0 then 'L'
  end as own_result,
  (select max(p.period) from public.match_period_scores p where p.match_id = m.id) as periods_recorded,
  exists (select 1 from public.player_match_stats pms where pms.match_id = m.id) as has_box_score
from public.matches m
join public.competitions c on c.id = m.competition_id
join public.seasons s on s.id = c.season_id
join public.teams th on th.id = m.home_team_id
join public.teams ta on ta.id = m.away_team_id
left join public.competition_teams cth on cth.competition_id = m.competition_id and cth.team_id = m.home_team_id
left join public.competition_teams cta on cta.competition_id = m.competition_id and cta.team_id = m.away_team_id
left join public.venues v on v.id = m.venue_id;

-- ---------------------------------------------------------------------------
-- Righe giocatore partita per partita (con contesto partita)
-- ---------------------------------------------------------------------------
create view public.v_player_game_lines with (security_invoker = true) as
select
  pms.id,
  pms.match_id,
  pms.team_id,
  t.is_own_team,
  pms.player_id,
  p.slug as player_slug,
  p.display_name as player_name,
  pms.raw_name,
  pms.jersey_number,
  pms.participation,
  pms.is_starter,
  pms.minutes,
  pms.points,
  pms.fgm,
  pms.fga,
  case when pms.fgm is not null and pms.fg3m is not null then pms.fgm - pms.fg3m end as fg2m,
  case when pms.fga is not null and pms.fg3a is not null then pms.fga - pms.fg3a end as fg2a,
  pms.fg3m,
  pms.fg3a,
  pms.ftm,
  pms.fta,
  pms.oreb,
  pms.dreb,
  pms.reb,
  pms.ast,
  pms.stl,
  pms.tov,
  pms.blk,
  pms.pf,
  pms.plus_minus,
  pms.extra,
  pms.source_id,
  ds.kind as source_kind,
  vm.season_id,
  vm.season_slug,
  vm.competition_id,
  vm.competition_slug,
  vm.competition_name,
  vm.competition_kind,
  vm.match_date,
  vm.status as match_status,
  vm.opponent_id,
  vm.opponent_name,
  vm.own_side,
  vm.own_score,
  vm.opponent_score,
  vm.own_result
from public.player_match_stats pms
join public.v_matches vm on vm.id = pms.match_id
join public.teams t on t.id = pms.team_id
join public.data_sources ds on ds.id = pms.source_id
left join public.players p on p.id = pms.player_id;

-- ---------------------------------------------------------------------------
-- Totali giocatore per competizione (solo dati partita, solo Bolo Sgreeners)
-- <stat>_games = partite in cui quella statistica è stata registrata: le medie
-- si calcolano su questo denominatore, non sulle presenze totali.
-- ---------------------------------------------------------------------------
create view public.v_player_competition_totals with (security_invoker = true) as
select
  l.player_id,
  l.season_id,
  l.competition_id,
  'match_data'::text as basis,
  count(*)::integer as games,
  sum(l.minutes) as minutes, count(l.minutes)::integer as minutes_games,
  sum(l.points)::integer as points, count(l.points)::integer as points_games,
  sum(l.fgm)::integer as fgm, sum(l.fga)::integer as fga, count(l.fga)::integer as fga_games,
  sum(l.fg2m)::integer as fg2m, sum(l.fg2a)::integer as fg2a, count(l.fg2a)::integer as fg2a_games,
  sum(l.fg3m)::integer as fg3m, sum(l.fg3a)::integer as fg3a, count(l.fg3a)::integer as fg3a_games,
  sum(l.ftm)::integer as ftm, sum(l.fta)::integer as fta, count(l.fta)::integer as fta_games,
  sum(l.oreb)::integer as oreb, count(l.oreb)::integer as oreb_games,
  sum(l.dreb)::integer as dreb, count(l.dreb)::integer as dreb_games,
  sum(l.reb)::integer as reb, count(l.reb)::integer as reb_games,
  sum(l.ast)::integer as ast, count(l.ast)::integer as ast_games,
  sum(l.stl)::integer as stl, count(l.stl)::integer as stl_games,
  sum(l.tov)::integer as tov, count(l.tov)::integer as tov_games,
  sum(l.blk)::integer as blk, count(l.blk)::integer as blk_games,
  sum(l.pf)::integer as pf, count(l.pf)::integer as pf_games,
  sum(l.plus_minus)::integer as plus_minus, count(l.plus_minus)::integer as plus_minus_games
from public.v_player_game_lines l
where l.is_own_team and l.player_id is not null and l.participation = 'played'
group by l.player_id, l.season_id, l.competition_id;

-- ---------------------------------------------------------------------------
-- Totali giocatore per stagione: dati partita + eventuali aggregati storici
-- ---------------------------------------------------------------------------
create view public.v_player_season_totals with (security_invoker = true) as
select
  t.player_id, t.season_id, 'match_data'::text as basis,
  sum(t.games)::integer as games,
  sum(t.minutes) as minutes, sum(t.minutes_games)::integer as minutes_games,
  sum(t.points)::integer as points, sum(t.points_games)::integer as points_games,
  sum(t.fgm)::integer as fgm, sum(t.fga)::integer as fga, sum(t.fga_games)::integer as fga_games,
  sum(t.fg2m)::integer as fg2m, sum(t.fg2a)::integer as fg2a, sum(t.fg2a_games)::integer as fg2a_games,
  sum(t.fg3m)::integer as fg3m, sum(t.fg3a)::integer as fg3a, sum(t.fg3a_games)::integer as fg3a_games,
  sum(t.ftm)::integer as ftm, sum(t.fta)::integer as fta, sum(t.fta_games)::integer as fta_games,
  sum(t.oreb)::integer as oreb, sum(t.oreb_games)::integer as oreb_games,
  sum(t.dreb)::integer as dreb, sum(t.dreb_games)::integer as dreb_games,
  sum(t.reb)::integer as reb, sum(t.reb_games)::integer as reb_games,
  sum(t.ast)::integer as ast, sum(t.ast_games)::integer as ast_games,
  sum(t.stl)::integer as stl, sum(t.stl_games)::integer as stl_games,
  sum(t.tov)::integer as tov, sum(t.tov_games)::integer as tov_games,
  sum(t.blk)::integer as blk, sum(t.blk_games)::integer as blk_games,
  sum(t.pf)::integer as pf, sum(t.pf_games)::integer as pf_games,
  sum(t.plus_minus)::integer as plus_minus, sum(t.plus_minus_games)::integer as plus_minus_games
from public.v_player_competition_totals t
group by t.player_id, t.season_id
union all
select
  a.player_id, a.season_id, 'historical_aggregate'::text as basis,
  sum(a.games)::integer,
  sum(a.minutes), sum(case when a.minutes is not null then a.games end)::integer,
  sum(a.points)::integer, sum(case when a.points is not null then a.games end)::integer,
  sum(a.fgm)::integer, sum(a.fga)::integer, sum(case when a.fga is not null then a.games end)::integer,
  sum(a.fgm - a.fg3m)::integer, sum(a.fga - a.fg3a)::integer, sum(case when a.fga is not null and a.fg3a is not null then a.games end)::integer,
  sum(a.fg3m)::integer, sum(a.fg3a)::integer, sum(case when a.fg3a is not null then a.games end)::integer,
  sum(a.ftm)::integer, sum(a.fta)::integer, sum(case when a.fta is not null then a.games end)::integer,
  sum(a.oreb)::integer, sum(case when a.oreb is not null then a.games end)::integer,
  sum(a.dreb)::integer, sum(case when a.dreb is not null then a.games end)::integer,
  sum(a.reb)::integer, sum(case when a.reb is not null then a.games end)::integer,
  sum(a.ast)::integer, sum(case when a.ast is not null then a.games end)::integer,
  sum(a.stl)::integer, sum(case when a.stl is not null then a.games end)::integer,
  sum(a.tov)::integer, sum(case when a.tov is not null then a.games end)::integer,
  sum(a.blk)::integer, sum(case when a.blk is not null then a.games end)::integer,
  sum(a.pf)::integer, sum(case when a.pf is not null then a.games end)::integer,
  null::integer, 0
from public.player_season_aggregates a
group by a.player_id, a.season_id;

-- ---------------------------------------------------------------------------
-- Totali di carriera con i Bolo Sgreeners (somma delle stagioni, entrambe le basi)
-- ---------------------------------------------------------------------------
create view public.v_player_career_totals with (security_invoker = true) as
select
  t.player_id,
  count(distinct t.season_id)::integer as seasons_with_stats,
  bool_or(t.basis = 'historical_aggregate') as includes_historical_aggregates,
  sum(t.games)::integer as games,
  sum(t.minutes) as minutes, sum(t.minutes_games)::integer as minutes_games,
  sum(t.points)::integer as points, sum(t.points_games)::integer as points_games,
  sum(t.fgm)::integer as fgm, sum(t.fga)::integer as fga, sum(t.fga_games)::integer as fga_games,
  sum(t.fg2m)::integer as fg2m, sum(t.fg2a)::integer as fg2a, sum(t.fg2a_games)::integer as fg2a_games,
  sum(t.fg3m)::integer as fg3m, sum(t.fg3a)::integer as fg3a, sum(t.fg3a_games)::integer as fg3a_games,
  sum(t.ftm)::integer as ftm, sum(t.fta)::integer as fta, sum(t.fta_games)::integer as fta_games,
  sum(t.oreb)::integer as oreb, sum(t.oreb_games)::integer as oreb_games,
  sum(t.dreb)::integer as dreb, sum(t.dreb_games)::integer as dreb_games,
  sum(t.reb)::integer as reb, sum(t.reb_games)::integer as reb_games,
  sum(t.ast)::integer as ast, sum(t.ast_games)::integer as ast_games,
  sum(t.stl)::integer as stl, sum(t.stl_games)::integer as stl_games,
  sum(t.tov)::integer as tov, sum(t.tov_games)::integer as tov_games,
  sum(t.blk)::integer as blk, sum(t.blk_games)::integer as blk_games,
  sum(t.pf)::integer as pf, sum(t.pf_games)::integer as pf_games,
  sum(t.plus_minus)::integer as plus_minus, sum(t.plus_minus_games)::integer as plus_minus_games
from public.v_player_season_totals t
group by t.player_id;

-- ---------------------------------------------------------------------------
-- Record di squadra Bolo Sgreeners per competizione
-- ---------------------------------------------------------------------------
create view public.v_own_competition_records with (security_invoker = true) as
select
  vm.season_id,
  vm.season_slug,
  vm.competition_id,
  vm.competition_slug,
  vm.competition_name,
  vm.competition_kind,
  vm.phase_order,
  count(*) filter (where vm.own_result is not null)::integer as played,
  count(*) filter (where vm.own_result = 'W')::integer as wins,
  count(*) filter (where vm.own_result = 'L')::integer as losses,
  coalesce(sum(vm.own_score) filter (where vm.own_result is not null), 0)::integer as points_for,
  coalesce(sum(vm.opponent_score) filter (where vm.own_result is not null), 0)::integer as points_against,
  count(*) filter (where vm.status = 'scheduled')::integer as scheduled
from public.v_matches vm
where vm.involves_own_team
group by vm.season_id, vm.season_slug, vm.competition_id, vm.competition_slug, vm.competition_name, vm.competition_kind, vm.phase_order;

-- ---------------------------------------------------------------------------
-- Roster di stagione con dati anagrafici e presenze
-- ---------------------------------------------------------------------------
create view public.v_season_roster with (security_invoker = true) as
select
  r.season_id,
  s.slug as season_slug,
  r.player_id,
  p.slug as player_slug,
  p.first_name,
  p.last_name,
  p.display_name,
  coalesce(r.nickname, p.nickname) as nickname,
  r.jersey_number,
  r.role,
  r.is_active,
  r.is_captain,
  p.photo_path,
  coalesce(t.games, 0) as games
from public.season_rosters r
join public.seasons s on s.id = r.season_id
join public.players p on p.id = r.player_id
left join public.v_player_season_totals t
  on t.player_id = r.player_id and t.season_id = r.season_id and t.basis = 'match_data';
