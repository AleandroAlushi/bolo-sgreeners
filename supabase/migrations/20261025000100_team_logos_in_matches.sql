-- Loghi delle squadre nelle partite (calendario, card e pagina partita): colonne aggiunte in
-- fondo alla vista, così "create or replace" resta compatibile con le view che la usano.
create or replace view public.v_matches with (security_invoker = true) as
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
  exists (select 1 from public.player_match_stats pms where pms.match_id = m.id) as has_box_score,
  th.logo_path as home_team_logo,
  ta.logo_path as away_team_logo
from public.matches m
join public.competitions c on c.id = m.competition_id
join public.seasons s on s.id = c.season_id
join public.teams th on th.id = m.home_team_id
join public.teams ta on ta.id = m.away_team_id
left join public.competition_teams cth on cth.competition_id = m.competition_id and cth.team_id = m.home_team_id
left join public.competition_teams cta on cta.competition_id = m.competition_id and cta.team_id = m.away_team_id
left join public.venues v on v.id = m.venue_id;
