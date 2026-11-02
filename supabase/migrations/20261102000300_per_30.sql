-- =============================================================================
-- Statistiche per 30 minuti (come i "per 36" dell'NBA, ma su partite da 40').
-- Valore = statistica / minuti × 30, contando solo le partite con i minuti registrati
-- (alcune gare non li hanno): per ogni statistica le view dei totali espongono
--   <stat>_on_min  la statistica nelle partite con i minuti
--   <stat>_min     i minuti di quelle partite in cui anche la statistica è registrata
-- Le colonne nuove sono in coda: le view esistenti e chi le usa non cambiano.
-- =============================================================================

create or replace view public.v_player_competition_totals with (security_invoker = true) as
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
  sum(l.plus_minus)::integer as plus_minus, count(l.plus_minus)::integer as plus_minus_games,
  -- per 30 minuti: <stat>_on_min = statistica nelle partite con i minuti registrati,
  -- <stat>_min = minuti di quelle partite (dove anche la statistica è registrata)
  sum(l.points) filter (where l.minutes is not null)::integer as points_on_min, sum(l.minutes) filter (where l.points is not null) as points_min,
  sum(l.fgm) filter (where l.minutes is not null)::integer as fgm_on_min, sum(l.minutes) filter (where l.fgm is not null) as fgm_min,
  sum(l.fga) filter (where l.minutes is not null)::integer as fga_on_min, sum(l.minutes) filter (where l.fga is not null) as fga_min,
  sum(l.fg3m) filter (where l.minutes is not null)::integer as fg3m_on_min, sum(l.minutes) filter (where l.fg3m is not null) as fg3m_min,
  sum(l.fg3a) filter (where l.minutes is not null)::integer as fg3a_on_min, sum(l.minutes) filter (where l.fg3a is not null) as fg3a_min,
  sum(l.ftm) filter (where l.minutes is not null)::integer as ftm_on_min, sum(l.minutes) filter (where l.ftm is not null) as ftm_min,
  sum(l.fta) filter (where l.minutes is not null)::integer as fta_on_min, sum(l.minutes) filter (where l.fta is not null) as fta_min,
  sum(l.oreb) filter (where l.minutes is not null)::integer as oreb_on_min, sum(l.minutes) filter (where l.oreb is not null) as oreb_min,
  sum(l.dreb) filter (where l.minutes is not null)::integer as dreb_on_min, sum(l.minutes) filter (where l.dreb is not null) as dreb_min,
  sum(l.reb) filter (where l.minutes is not null)::integer as reb_on_min, sum(l.minutes) filter (where l.reb is not null) as reb_min,
  sum(l.ast) filter (where l.minutes is not null)::integer as ast_on_min, sum(l.minutes) filter (where l.ast is not null) as ast_min,
  sum(l.stl) filter (where l.minutes is not null)::integer as stl_on_min, sum(l.minutes) filter (where l.stl is not null) as stl_min,
  sum(l.tov) filter (where l.minutes is not null)::integer as tov_on_min, sum(l.minutes) filter (where l.tov is not null) as tov_min,
  sum(l.blk) filter (where l.minutes is not null)::integer as blk_on_min, sum(l.minutes) filter (where l.blk is not null) as blk_min,
  sum(l.pf) filter (where l.minutes is not null)::integer as pf_on_min, sum(l.minutes) filter (where l.pf is not null) as pf_min,
  sum(l.plus_minus) filter (where l.minutes is not null)::integer as plus_minus_on_min, sum(l.minutes) filter (where l.plus_minus is not null) as plus_minus_min
from public.v_player_game_lines l
where l.is_own_team and l.player_id is not null and l.participation = 'played'
group by l.player_id, l.season_id, l.competition_id;

create or replace view public.v_player_season_totals with (security_invoker = true) as
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
  sum(t.plus_minus)::integer as plus_minus, sum(t.plus_minus_games)::integer as plus_minus_games,
  sum(t.points_on_min)::integer as points_on_min, sum(t.points_min) as points_min,
  sum(t.fgm_on_min)::integer as fgm_on_min, sum(t.fgm_min) as fgm_min,
  sum(t.fga_on_min)::integer as fga_on_min, sum(t.fga_min) as fga_min,
  sum(t.fg3m_on_min)::integer as fg3m_on_min, sum(t.fg3m_min) as fg3m_min,
  sum(t.fg3a_on_min)::integer as fg3a_on_min, sum(t.fg3a_min) as fg3a_min,
  sum(t.ftm_on_min)::integer as ftm_on_min, sum(t.ftm_min) as ftm_min,
  sum(t.fta_on_min)::integer as fta_on_min, sum(t.fta_min) as fta_min,
  sum(t.oreb_on_min)::integer as oreb_on_min, sum(t.oreb_min) as oreb_min,
  sum(t.dreb_on_min)::integer as dreb_on_min, sum(t.dreb_min) as dreb_min,
  sum(t.reb_on_min)::integer as reb_on_min, sum(t.reb_min) as reb_min,
  sum(t.ast_on_min)::integer as ast_on_min, sum(t.ast_min) as ast_min,
  sum(t.stl_on_min)::integer as stl_on_min, sum(t.stl_min) as stl_min,
  sum(t.tov_on_min)::integer as tov_on_min, sum(t.tov_min) as tov_min,
  sum(t.blk_on_min)::integer as blk_on_min, sum(t.blk_min) as blk_min,
  sum(t.pf_on_min)::integer as pf_on_min, sum(t.pf_min) as pf_min,
  sum(t.plus_minus_on_min)::integer as plus_minus_on_min, sum(t.plus_minus_min) as plus_minus_min
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
  null::integer, 0,
  sum(case when a.minutes is not null then a.points end)::integer, sum(case when a.points is not null then a.minutes end),
  sum(case when a.minutes is not null then a.fgm end)::integer, sum(case when a.fgm is not null then a.minutes end),
  sum(case when a.minutes is not null then a.fga end)::integer, sum(case when a.fga is not null then a.minutes end),
  sum(case when a.minutes is not null then a.fg3m end)::integer, sum(case when a.fg3m is not null then a.minutes end),
  sum(case when a.minutes is not null then a.fg3a end)::integer, sum(case when a.fg3a is not null then a.minutes end),
  sum(case when a.minutes is not null then a.ftm end)::integer, sum(case when a.ftm is not null then a.minutes end),
  sum(case when a.minutes is not null then a.fta end)::integer, sum(case when a.fta is not null then a.minutes end),
  sum(case when a.minutes is not null then a.oreb end)::integer, sum(case when a.oreb is not null then a.minutes end),
  sum(case when a.minutes is not null then a.dreb end)::integer, sum(case when a.dreb is not null then a.minutes end),
  sum(case when a.minutes is not null then a.reb end)::integer, sum(case when a.reb is not null then a.minutes end),
  sum(case when a.minutes is not null then a.ast end)::integer, sum(case when a.ast is not null then a.minutes end),
  sum(case when a.minutes is not null then a.stl end)::integer, sum(case when a.stl is not null then a.minutes end),
  sum(case when a.minutes is not null then a.tov end)::integer, sum(case when a.tov is not null then a.minutes end),
  sum(case when a.minutes is not null then a.blk end)::integer, sum(case when a.blk is not null then a.minutes end),
  sum(case when a.minutes is not null then a.pf end)::integer, sum(case when a.pf is not null then a.minutes end),
  null::integer, null::numeric
from public.player_season_aggregates a
group by a.player_id, a.season_id;

create or replace view public.v_player_career_totals with (security_invoker = true) as
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
  sum(t.plus_minus)::integer as plus_minus, sum(t.plus_minus_games)::integer as plus_minus_games,
  sum(t.points_on_min)::integer as points_on_min, sum(t.points_min) as points_min,
  sum(t.fgm_on_min)::integer as fgm_on_min, sum(t.fgm_min) as fgm_min,
  sum(t.fga_on_min)::integer as fga_on_min, sum(t.fga_min) as fga_min,
  sum(t.fg3m_on_min)::integer as fg3m_on_min, sum(t.fg3m_min) as fg3m_min,
  sum(t.fg3a_on_min)::integer as fg3a_on_min, sum(t.fg3a_min) as fg3a_min,
  sum(t.ftm_on_min)::integer as ftm_on_min, sum(t.ftm_min) as ftm_min,
  sum(t.fta_on_min)::integer as fta_on_min, sum(t.fta_min) as fta_min,
  sum(t.oreb_on_min)::integer as oreb_on_min, sum(t.oreb_min) as oreb_min,
  sum(t.dreb_on_min)::integer as dreb_on_min, sum(t.dreb_min) as dreb_min,
  sum(t.reb_on_min)::integer as reb_on_min, sum(t.reb_min) as reb_min,
  sum(t.ast_on_min)::integer as ast_on_min, sum(t.ast_min) as ast_min,
  sum(t.stl_on_min)::integer as stl_on_min, sum(t.stl_min) as stl_min,
  sum(t.tov_on_min)::integer as tov_on_min, sum(t.tov_min) as tov_min,
  sum(t.blk_on_min)::integer as blk_on_min, sum(t.blk_min) as blk_min,
  sum(t.pf_on_min)::integer as pf_on_min, sum(t.pf_min) as pf_min,
  sum(t.plus_minus_on_min)::integer as plus_minus_on_min, sum(t.plus_minus_min) as plus_minus_min
from public.v_player_season_totals t
group by t.player_id;

-- Catalogo: nuovo tipo "per_30" e soglia in minuti per le classifiche
alter table public.stat_definitions drop constraint if exists stat_definitions_kind_check;
alter table public.stat_definitions
  add constraint stat_definitions_kind_check check (kind in ('total', 'per_game', 'percentage', 'per_30'));
alter table public.stat_definitions drop constraint if exists stat_definitions_check;
alter table public.stat_definitions
  add constraint stat_definitions_check check (
    (kind in ('total', 'per_game', 'per_30') and column_name is not null)
    or (kind = 'percentage' and numerator_column is not null and denominator_column is not null)
  );
alter table public.stat_definitions
  add column min_minutes integer not null default 0 check (min_minutes >= 0);
comment on column public.stat_definitions.min_minutes is
  'Minuti giocati minimi (nelle partite con i minuti) per entrare nella classifica: evita che 2 punti in 3 minuti valgano 20 per 30''.';

-- Classifiche per 30 minuti: almeno 4 partite con i minuti e 100 minuti in campo
insert into public.stat_definitions
  (key, label, short_label, category, kind, column_name, decimals, higher_is_better, show_in_leaderboards, min_games, min_minutes, sort_order)
values
  ('pts_p30',  'Punti per 30''',             'PTS/30',  'scoring',    'per_30', 'points',     1, true,  true,  4, 100, 22),
  ('reb_p30',  'Rimbalzi per 30''',          'REB/30',  'rebounding', 'per_30', 'reb',        1, true,  true,  4, 100, 34),
  ('oreb_p30', 'Rimbalzi offensivi per 30''','OREB/30', 'rebounding', 'per_30', 'oreb',       1, true,  false, 4, 100, 35),
  ('dreb_p30', 'Rimbalzi difensivi per 30''','DREB/30', 'rebounding', 'per_30', 'dreb',       1, true,  false, 4, 100, 36),
  ('ast_p30',  'Assist per 30''',            'AST/30',  'playmaking', 'per_30', 'ast',        1, true,  true,  4, 100, 42),
  ('stl_p30',  'Recuperi per 30''',          'REC/30',  'defense',    'per_30', 'stl',        1, true,  true,  4, 100, 53),
  ('blk_p30',  'Stoppate per 30''',          'STP/30',  'defense',    'per_30', 'blk',        1, true,  true,  4, 100, 54),
  ('fg3m_p30', 'Triple per 30''',            '3PM/30',  'shooting',   'per_30', 'fg3m',       1, true,  true,  4, 100, 66),
  ('pm_p30',   'Plus/minus per 30''',        '+/-/30',  'impact',     'per_30', 'plus_minus', 1, true,  true,  4, 100, 81),
  ('tov_p30',  'Palle perse per 30''',       'PP/30',   'discipline', 'per_30', 'tov',        1, false, false, 4, 100, 92),
  ('pf_p30',   'Falli per 30''',             'FALLI/30','discipline', 'per_30', 'pf',         1, false, false, 4, 100, 93);
