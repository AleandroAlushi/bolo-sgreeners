-- =============================================================================
-- DATI DEMO — solo per provare le schermate su un database vuoto.
-- NON usare insieme ai dati reali. Tutto ciò che è demo è riconoscibile:
--   stagione 1999-00 ("DEMO"), slug che iniziano con "demo-", fonte 'demo'.
-- Per eliminarli: supabase/demo/delete-demo.sql
-- =============================================================================
begin;

insert into public.data_sources (kind, label, source_key, notes)
values ('manual', 'DATI DEMO (non reali)', 'demo', 'Creati da supabase/demo/seed-demo.sql')
on conflict (source_key) do nothing;

insert into public.teams (slug, name, short_name, is_own_team)
values ('bolo-sgreeners', 'Bolo Sgreeners', 'Sgreeners', true)
on conflict (slug) do nothing;
insert into public.teams (slug, name) values
  ('demo-avversari-uno', 'DEMO Avversari Uno'),
  ('demo-avversari-due', 'DEMO Avversari Due')
on conflict (slug) do nothing;

insert into public.seasons (slug, label, notes) values ('1999-00', 'Stagione DEMO', 'Dati dimostrativi, non reali')
on conflict (slug) do nothing;

insert into public.competitions (season_id, slug, name, kind, phase_order)
select id, 'demo-campionato', 'DEMO Campionato', 'regular_season', 1 from public.seasons where slug = '1999-00'
on conflict (season_id, slug) do nothing;

insert into public.competition_teams (competition_id, team_id, display_name)
select c.id, t.id, t.name
from public.competitions c join public.seasons s on s.id = c.season_id and s.slug = '1999-00'
cross join public.teams t where t.slug in ('bolo-sgreeners', 'demo-avversari-uno', 'demo-avversari-due')
on conflict do nothing;

insert into public.standings_rules (competition_id, points_win, points_loss, tiebreakers, notes)
select c.id, 2, 0, array['points', 'head_to_head', 'point_diff'], 'Regole demo'
from public.competitions c where c.slug = 'demo-campionato'
on conflict do nothing;

insert into public.players (slug, first_name, last_name, nickname) values
  ('demo-mario-rossi', 'Mario', 'Rossi (demo)', 'Demo1'),
  ('demo-luigi-bianchi', 'Luigi', 'Bianchi (demo)', 'Demo2'),
  ('demo-paolo-verdi', 'Paolo', 'Verdi (demo)', 'Demo3')
on conflict (slug) do nothing;

insert into public.season_rosters (season_id, player_id, jersey_number, role)
select s.id, p.id, n.jersey, n.role
from public.seasons s
join (values ('demo-mario-rossi', '4', 'Playmaker'), ('demo-luigi-bianchi', '10', 'Ala'), ('demo-paolo-verdi', '15', 'Centro')) n(slug, jersey, role) on true
join public.players p on p.slug = n.slug
where s.slug = '1999-00'
on conflict do nothing;

-- tre partite: due giocate (una tra avversari, per la classifica) e una in programma
insert into public.matches (import_key, competition_id, round_number, match_date, home_team_id, away_team_id, home_score, away_score, status, schedule_source_id, result_source_id, notes)
select v.key, c.id, v.round, v.d::date, h.id, a.id, v.hs, v.as_, v.status::public.match_status, src.id, case when v.hs is null then null else src.id end, 'Partita DEMO'
from public.competitions c
cross join public.data_sources src
join (values
  ('demo-1', 1, '1999-10-10', 'bolo-sgreeners', 'demo-avversari-uno', 60, 52, 'played'),
  ('demo-2', 1, '1999-10-11', 'demo-avversari-due', 'demo-avversari-uno', 48, 50, 'played'),
  ('demo-3', 2, '1999-10-20', 'demo-avversari-due', 'bolo-sgreeners', null, null, 'scheduled')
) v(key, round, d, home, away, hs, as_, status) on true
join public.teams h on h.slug = v.home
join public.teams a on a.slug = v.away
where c.slug = 'demo-campionato' and src.source_key = 'demo'
on conflict (import_key) do nothing;

insert into public.player_match_stats (match_id, team_id, player_id, raw_name, jersey_number, minutes, points, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, tov, blk, pf, source_id)
select m.id, t.id, p.id, p.nickname, v.j, v.mins, v.pts, v.fgm, v.fga, v.f3m, v.f3a, v.ftm, v.fta, v.o, v.d, v.o + v.d, v.ast, v.stl, v.tov, v.blk, v.pf, src.id
from (values
  ('demo-mario-rossi', '4', 30, 22, 8, 15, 2, 5, 4, 4, 1, 3, 6, 3, 2, 0, 2),
  ('demo-luigi-bianchi', '10', 28, 20, 8, 14, 0, 2, 4, 6, 2, 5, 2, 1, 3, 1, 3),
  ('demo-paolo-verdi', '15', 25, 18, 8, 12, 0, 0, 2, 4, 5, 7, 1, 0, 1, 3, 4)
) v(slug, j, mins, pts, fgm, fga, f3m, f3a, ftm, fta, o, d, ast, stl, tov, blk, pf)
join public.players p on p.slug = v.slug
join public.matches m on m.import_key = 'demo-1'
join public.teams t on t.is_own_team
join public.data_sources src on src.source_key = 'demo'
on conflict do nothing;

commit;
