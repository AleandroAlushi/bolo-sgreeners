-- Numero di maglia mostrato = numero principale del giocatore nella stagione (season_rosters).
-- Chi gioca con una maglia prestata (es. #69 in attesa della propria) resta registrato con il
-- numero indossato in player_match_stats, esposto qui come worn_jersey_number.

create or replace view public.v_player_game_lines with (security_invoker = true) as
select
  pms.id,
  pms.match_id,
  pms.team_id,
  t.is_own_team,
  pms.player_id,
  p.slug as player_slug,
  p.display_name as player_name,
  pms.raw_name,
  coalesce(sr.jersey_number, pms.jersey_number) as jersey_number,
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
  vm.own_result,
  pms.jersey_number as worn_jersey_number
from public.player_match_stats pms
join public.v_matches vm on vm.id = pms.match_id
join public.teams t on t.id = pms.team_id
join public.data_sources ds on ds.id = pms.source_id
left join public.players p on p.id = pms.player_id
left join public.season_rosters sr on sr.season_id = vm.season_id and sr.player_id = pms.player_id;
