-- Permessi del ruolo "stats" (Statistiche): vedi 20261122000100_ruolo_statistiche.sql.

-- membri della squadra: anche chi prende le statistiche (diretta, box score, dati riservati)
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role::text in ('admin', 'team', 'stats')
  );
$$;

-- chi può fare le grafiche: admin e statistiche
create or replace function public.can_make_graphics()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role::text in ('admin', 'stats')
  );
$$;
grant execute on function public.can_make_graphics() to anon, authenticated;

-- foto caricate per le grafiche: anche chi prende le statistiche, ma solo nella cartella grafiche/
create policy "media_graphics_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and name like 'grafiche/%' and public.can_make_graphics());
