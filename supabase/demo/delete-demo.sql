-- Elimina tutti e soli i dati creati da seed-demo.sql.
begin;
delete from public.matches where import_key like 'demo-%';
delete from public.season_rosters where player_id in (select id from public.players where slug like 'demo-%');
delete from public.players where slug like 'demo-%';
delete from public.seasons where slug = '1999-00';
delete from public.teams where slug like 'demo-%';
delete from public.data_sources where source_key = 'demo';
commit;
