-- =============================================================================
-- Sicurezza: ruoli, Row Level Security, storage.
--   Visitatore (anon o autenticato non admin): sola lettura dei dati pubblici.
--   Admin (riga in user_roles): lettura completa e scrittura.
-- Per creare il primo admin vedi README ("Creare un amministratore").
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Tabelle leggibili da tutti
do $$
declare
  t text;
begin
  foreach t in array array[
    'data_sources', 'seasons', 'teams', 'competitions', 'competition_teams', 'standings_rules',
    'standings_adjustments', 'official_standings', 'venues', 'matches', 'match_period_scores',
    'players', 'player_aliases', 'season_rosters', 'player_match_stats', 'team_match_stats',
    'player_season_aggregates', 'stat_definitions', 'stat_columns'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_public_read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;

  -- Tabelle riservate agli admin (contengono nomi file e soprannomi degli avversari)
  foreach t in array array['team_aliases', 'imports', 'source_conflicts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_admin_all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end;
$$;

-- user_roles: ognuno vede solo il proprio ruolo; i ruoli si assegnano via SQL.
alter table public.user_roles enable row level security;
create policy "user_roles_read_own" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage
--   match-files: file originali degli import (privato, solo admin)
--   media:       foto giocatori e loghi (lettura pubblica, scrittura admin)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('match-files', 'match-files', false, 5242880),
  ('media', 'media', true, 5242880)
on conflict (id) do nothing;

create policy "match_files_admin_read" on storage.objects
  for select to authenticated using (bucket_id = 'match-files' and public.is_admin());
create policy "match_files_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'match-files' and public.is_admin());
create policy "match_files_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'match-files' and public.is_admin());
create policy "match_files_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'match-files' and public.is_admin());

create policy "media_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');
create policy "media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "media_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
