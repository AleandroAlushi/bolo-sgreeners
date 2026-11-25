-- 1) Statistiche live solo per admin e "Statistiche" (prima anche l'account di squadra "team").
-- 2) Chat della diretta: chi guarda scrive con un nome scelto da lui, senza account.

-- ---------------------------------------------------------------------------
-- Chi prende le statistiche: admin e stats
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
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
grant execute on function public.is_staff() to anon, authenticated;

drop policy if exists "live_games_team_write" on public.live_games;
drop policy if exists "live_events_team_write" on public.live_events;
create policy "live_games_staff_write" on public.live_games for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "live_events_staff_write" on public.live_events for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

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
  if not public.is_staff() then
    raise exception 'Operazione riservata a chi prende le statistiche' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- Chat della diretta
-- ---------------------------------------------------------------------------
create table public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.live_games (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  body text not null check (char_length(body) between 1 and 200),
  -- codice casuale salvato sul telefono di chi scrive: serve per i limiti e per bloccare chi
  -- esagera, non si legge dal sito. Niente indirizzo IP: in palestra molti condividono lo stesso
  -- Wi-Fi e bloccarne uno vorrebbe dire bloccare tutta la tribuna.
  device uuid not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index live_chat_messages_game_idx on public.live_chat_messages (game_id, created_at);
create index live_chat_messages_device_idx on public.live_chat_messages (device, created_at);

-- chat aperta o chiusa (admin e statistiche la possono chiudere in qualsiasi momento)
alter table public.live_games add column chat_open boolean not null default true;

-- chi non può più scrivere (bloccato da admin o statistiche)
create table public.live_chat_blocks (
  id uuid primary key default gen_random_uuid(),
  device uuid not null,
  name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.live_chat_messages enable row level security;
alter table public.live_chat_blocks enable row level security;

-- lettura pubblica dei messaggi visibili, senza la colonna device
create policy "live_chat_public_read" on public.live_chat_messages for select to anon, authenticated
  using (not hidden or public.is_staff());
revoke all on public.live_chat_messages from anon, authenticated;
grant select (id, game_id, name, body, hidden, created_at) on public.live_chat_messages to anon, authenticated;
-- i blocchi li vedono solo admin e statistiche
revoke all on public.live_chat_blocks from anon, authenticated;
grant select on public.live_chat_blocks to authenticated;
create policy "live_chat_blocks_staff_read" on public.live_chat_blocks for select to authenticated using (public.is_staff());

-- testo "normalizzato" per il filtro: minuscolo, senza accenti, numeri al posto delle lettere
-- (c4zz0), senza lettere ripetute (cazzzo → cazo)
create or replace function public.chat_normalize(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(t), 'àáâäèéêëìíîïòóôöùúûü0134578@$', 'aaaaeeeeiiiioooouuuuoieastbas'),
    '(.)\1+', '\1', 'g'
  );
$$;

-- parolacce, insulti e bestemmie (già normalizzati: niente lettere doppie)
create or replace function public.chat_is_offensive(t text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  n text := public.chat_normalize(t);
  -- inizi di parola
  stems text[] := array[
    'caz', 'minchi', 'merd', 'stronz', 'vafancul', 'fancul', 'vafa', 'culaton', 'richion', 'froc',
    'putan', 'troi', 'zocol', 'mignot', 'bastard', 'coglion', 'incul', 'pompin', 'suchiam', 'sucam',
    'fotut', 'fotit', 'mortaci', 'niga', 'mongolo', 'mongoloid', 'ritardat', 'terone', 'zingar',
    'handicapat', 'fuck', 'shit', 'bitch', 'puta', 'hitler', 'nazist'
  ];
  -- parole intere
  words text[] := array['negro', 'negra', 'negri', 'negre', 'culo', 'figa', 'fighe', 'suca', 'cagna', 'sega', 'seghe', 'dick', 'cock'];
  -- bestemmie: le parole possono essere attaccate o separate da spazi e trattini ("porco-dio")
  phrases text[] := array[
    'porc[oa]?[^a-z]*dio', 'dio[^a-z]*(can|porc|bestia|merd|maial)', 'porc[oa]?[^a-z]*madon',
    'madon+a[^a-z]*(putan|troi|maial)', 'cristo[^a-z]*(can|porc)'
  ];
  s text;
begin
  foreach s in array stems loop
    if n ~ ('(^|[^a-z])' || s) then return true; end if;
  end loop;
  foreach s in array words loop
    if n ~ ('(^|[^a-z])' || s || '($|[^a-z])') then return true; end if;
  end loop;
  foreach s in array phrases loop
    if n ~ ('(^|[^a-z])' || s) then return true; end if;
  end loop;
  return false;
end;
$$;

-- invio di un messaggio: restituisce null se è andato bene, altrimenti il motivo
create or replace function public.live_chat_send(p_game uuid, p_name text, p_body text, p_device uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_body text := regexp_replace(trim(coalesce(p_body, '')), '\s+', ' ', 'g');
  v_game public.live_games%rowtype;
begin
  if p_device is null then return 'Ricarica la pagina e riprova.'; end if;
  select * into v_game from public.live_games where id = p_game;
  if not found or v_game.status <> 'live' then return 'La chat è aperta solo durante la diretta.'; end if;
  if not v_game.chat_open then return 'La chat è chiusa.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 24 then return 'Il nome deve avere da 2 a 24 caratteri.'; end if;
  if char_length(v_body) < 1 then return 'Scrivi qualcosa.'; end if;
  if char_length(v_body) > 200 then return 'Massimo 200 caratteri.'; end if;
  if exists (
    select 1 from public.live_chat_blocks b where b.device = p_device
  ) then
    return 'Non puoi più scrivere in questa chat.';
  end if;
  if public.chat_is_offensive(v_name) then return 'Scegli un altro nome.'; end if;
  if public.chat_is_offensive(v_body) then
    return 'Il messaggio contiene parole non ammesse: ci leggono anche genitori e ragazzi.';
  end if;
  if v_body ~* '(https?://|www\.|\.(com|it|net|org)(/|\s|$))' then return 'I link non sono ammessi.'; end if;
  -- limiti: un messaggio ogni 3 secondi e al massimo 8 al minuto per telefono
  if exists (
    select 1 from public.live_chat_messages m
    where m.device = p_device and m.created_at > now() - interval '3 seconds'
  ) then
    return 'Piano! Aspetta qualche secondo.';
  end if;
  if (
    select count(*) from public.live_chat_messages m
    where m.device = p_device and m.created_at > now() - interval '1 minute'
  ) >= 8 then
    return 'Troppi messaggi: riprova tra un minuto.';
  end if;
  -- niente doppioni uguali di fila
  if exists (
    select 1 from public.live_chat_messages m
    where m.device = p_device and m.game_id = p_game and lower(m.body) = lower(v_body)
      and m.created_at > now() - interval '2 minutes'
  ) then
    return 'Hai già scritto questo messaggio.';
  end if;
  insert into public.live_chat_messages (game_id, name, body, device)
  values (p_game, v_name, v_body, p_device);
  return null;
end;
$$;
revoke all on function public.live_chat_send(uuid, text, text, uuid) from public;
grant execute on function public.live_chat_send(uuid, text, text, uuid) to anon, authenticated;

-- moderazione (admin e statistiche): nasconde un messaggio e, se richiesto, blocca chi l'ha scritto
-- (tutti i suoi messaggi spariscono e non può più scrivere)
create or replace function public.live_chat_moderate(p_message uuid, p_block boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.live_chat_messages%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Operazione riservata a chi prende le statistiche' using errcode = '42501';
  end if;
  select * into m from public.live_chat_messages where id = p_message;
  if not found then return; end if;
  update public.live_chat_messages set hidden = true where id = p_message;
  if p_block then
    insert into public.live_chat_blocks (device, name, created_by)
    values (m.device, m.name, (select auth.uid()));
    update public.live_chat_messages set hidden = true where device = m.device;
  end if;
end;
$$;
revoke all on function public.live_chat_moderate(uuid, boolean) from public, anon;
grant execute on function public.live_chat_moderate(uuid, boolean) to authenticated;

-- apre o chiude la chat di una diretta (admin e statistiche)
create or replace function public.live_chat_set_open(p_game uuid, p_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Operazione riservata a chi prende le statistiche' using errcode = '42501';
  end if;
  update public.live_games set chat_open = p_open where id = p_game;
end;
$$;
revoke all on function public.live_chat_set_open(uuid, boolean) from public, anon;
grant execute on function public.live_chat_set_open(uuid, boolean) to authenticated;
