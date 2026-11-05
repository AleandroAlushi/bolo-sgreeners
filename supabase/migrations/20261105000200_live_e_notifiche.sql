-- =============================================================================
-- Partita in diretta e notifiche push.
--
-- live_games / live_events: le statistiche prese a bordo campo dal sito (area squadra), evento per
-- evento. Chiunque può leggerle (pagina live della partita); scrivono solo i membri della squadra
-- (ruolo team o admin). A fine partita gli eventi diventano il box score ufficiale con la stessa
-- funzione dell'import HTML (import_live_report → import_match_report).
--
-- push_subscriptions / push_log: chi ha attivato le notifiche (giorno della partita, un'ora prima,
-- risultato finale). Le iscrizioni non sono leggibili dal pubblico: le invia uno script con la
-- chiave service role (GitHub Actions).
-- =============================================================================

create table public.live_games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  status text not null default 'live' check (status in ('live', 'finished', 'saved')),
  period integer not null default 1 check (period between 1 and 9),
  periods integer not null default 4 check (periods between 1 and 4),
  period_seconds integer not null default 600 check (period_seconds between 60 and 1800),
  -- orologio di gioco: secondi rimasti nel periodo al momento di clock_updated_at
  clock_remaining integer not null default 600 check (clock_remaining >= 0),
  clock_running boolean not null default false,
  clock_updated_at timestamptz not null default now(),
  -- convocati: [{ "player_id": uuid, "jersey": "11", "name": "Macca" }]
  roster jsonb not null default '[]'::jsonb,
  opponent_name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create trigger live_games_updated_at before update on public.live_games
  for each row execute function public.set_updated_at();

create table public.live_events (
  -- id generato dal dispositivo: l'invio si può ripetere senza duplicati (palestre senza campo)
  id uuid primary key,
  game_id uuid not null references public.live_games (id) on delete cascade,
  -- ordine degli eventi sul dispositivo che prende le statistiche
  n integer not null,
  period integer not null check (period between 1 and 9),
  -- secondi rimasti nel periodo (null se l'orologio non è usato)
  clock integer check (clock >= 0),
  team text not null check (team in ('own', 'opp')),
  player_id uuid references public.players (id) on delete set null,
  kind text not null check (kind in ('2pt', '3pt', '1pt', 'dreb', 'oreb', 'tov', 'stl', 'ast', 'blk', 'foul', 'in', 'out')),
  made boolean,
  created_at timestamptz not null default now()
);
create index live_events_game_idx on public.live_events (game_id, n);

alter table public.live_games enable row level security;
alter table public.live_events enable row level security;
create policy "live_games_public_read" on public.live_games for select to anon, authenticated using (true);
create policy "live_events_public_read" on public.live_events for select to anon, authenticated using (true);
create policy "live_games_team_write" on public.live_games for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());
create policy "live_events_team_write" on public.live_events for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());

-- A fine partita il box score degli eventi (costruito dal sito) passa dalla stessa funzione
-- dell'import HTML. import_match_report è riservata agli admin: qui basta essere della squadra,
-- così può chiudere la partita anche chi ha preso le statistiche al posto dell'admin.
create or replace function public.import_live_report(game uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.live_games%rowtype;
  v_result jsonb;
begin
  if not public.is_team_member() then
    raise exception 'Operazione riservata alla squadra' using errcode = '42501';
  end if;
  select * into v_game from public.live_games where id = game;
  if not found then
    raise exception 'Partita live non trovata';
  end if;
  if (payload ->> 'match_id')::uuid is distinct from v_game.match_id then
    raise exception 'Il box score non corrisponde alla partita live';
  end if;
  v_result := public.import_match_report(payload);
  update public.live_games set status = 'saved', finished_at = coalesce(finished_at, now()) where id = game;
  return v_result;
end;
$$;
revoke all on function public.import_live_report(uuid, jsonb) from public, anon;
grant execute on function public.import_live_report(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Notifiche push
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_admin_read" on public.push_subscriptions for select to authenticated using (public.is_admin());

-- iscrizione e disiscrizione dal browser, senza poter leggere le iscrizioni degli altri
create or replace function public.push_subscribe(endpoint text, p256dh text, auth text, user_agent text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_subscriptions (endpoint, p256dh, auth, user_agent)
  values (endpoint, p256dh, auth, left(user_agent, 300))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
$$;
create or replace function public.push_unsubscribe(endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions s where s.endpoint = push_unsubscribe.endpoint;
$$;
grant execute on function public.push_subscribe(text, text, text, text) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

-- notifiche già inviate (una per partita e tipo): lo script può girare spesso senza ripetersi
create table public.push_log (
  match_id uuid not null references public.matches (id) on delete cascade,
  kind text not null check (kind in ('giorno', 'ora', 'live', 'finale')),
  sent_at timestamptz not null default now(),
  recipients integer not null default 0,
  primary key (match_id, kind)
);
alter table public.push_log enable row level security;
create policy "push_log_admin_read" on public.push_log for select to authenticated using (public.is_admin());
