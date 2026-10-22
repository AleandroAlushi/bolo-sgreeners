-- =============================================================================
-- Squadra: staff per stagione, vice capitano, MVP di partita, area riservata.
--   Pubblico:  staff, MVP.
--   Squadra (ruolo 'team' o admin): anche date di nascita, allenamenti e pause.
--   Admin:     scrittura.
-- =============================================================================

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role::text in ('admin', 'team')
  );
$$;

grant execute on function public.is_team_member() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  first_name text not null,
  last_name text not null,
  display_name text generated always as (first_name || ' ' || last_name) stored,
  photo_path text,
  -- membro dello staff che ha anche giocato: la sua scheda giocatore
  player_id uuid unique references public.players (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_members_updated_at before update on public.staff_members
  for each row execute function public.set_updated_at();

create table public.season_staff (
  season_id uuid not null references public.seasons (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  role text not null,
  sort_order integer not null default 0,
  source_id uuid references public.data_sources (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (season_id, staff_id, role)
);
create index season_staff_staff_idx on public.season_staff (staff_id);

-- ---------------------------------------------------------------------------
-- Roster: vice capitano accanto al capitano
-- ---------------------------------------------------------------------------
alter table public.season_rosters add column is_vice_captain boolean not null default false;

-- ---------------------------------------------------------------------------
-- MVP di partita (scelto dalla squadra, inserito dall'admin)
-- ---------------------------------------------------------------------------
create table public.match_awards (
  match_id uuid not null references public.matches (id) on delete cascade,
  award text not null default 'mvp' check (award in ('mvp')),
  player_id uuid not null references public.players (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  primary key (match_id, award)
);
create index match_awards_player_idx on public.match_awards (player_id);

-- ---------------------------------------------------------------------------
-- Dati riservati alla squadra
-- ---------------------------------------------------------------------------
create table public.private_profiles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid unique references public.players (id) on delete cascade,
  staff_id uuid unique references public.staff_members (id) on delete cascade,
  birth_date date,
  notes text,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(player_id, staff_id) = 1)
);
create trigger private_profiles_updated_at before update on public.private_profiles
  for each row execute function public.set_updated_at();

-- Allenamenti della stagione (giorni ISO: 1 = lunedì … 7 = domenica) e pause
create table public.training_schedule (
  season_id uuid primary key references public.seasons (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  weekdays smallint[] not null default '{1,4}' check (weekdays <@ '{1,2,3,4,5,6,7}'),
  notes text
);

create table public.training_breaks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  label text not null
);
create index training_breaks_season_idx on public.training_breaks (season_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['staff_members', 'season_staff', 'match_awards'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_public_read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;

  foreach t in array array['private_profiles', 'training_schedule', 'training_breaks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_team_read" on public.%I for select to authenticated using (public.is_team_member())', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accessi: l'admin assegna i ruoli dall'app (gli account si creano in Supabase Auth)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_access()
returns table (user_id uuid, email text, role text, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Operazione riservata agli amministratori' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, ur.role::text, u.last_sign_in_at
    from auth.users u
    left join public.user_roles ur on ur.user_id = u.id
    order by ur.role nulls last, u.email;
end;
$$;

create or replace function public.admin_set_role(target_email text, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Operazione riservata agli amministratori' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(target_email));
  if v_user is null then
    raise exception 'Nessun account con email %: crealo prima in Supabase (Authentication → Users)', target_email
      using hint = 'user_not_found';
  end if;
  if v_user = auth.uid() and coalesce(new_role, '') <> 'admin' then
    raise exception 'Non puoi togliere il ruolo admin a te stesso' using hint = 'self_demote';
  end if;
  if new_role is null or new_role = '' then
    delete from public.user_roles where user_id = v_user;
  else
    insert into public.user_roles (user_id, role) values (v_user, new_role::public.app_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;

revoke execute on function public.admin_list_access() from public, anon;
revoke execute on function public.admin_set_role(text, text) from public, anon;
grant execute on function public.admin_list_access() to authenticated;
grant execute on function public.admin_set_role(text, text) to authenticated;
