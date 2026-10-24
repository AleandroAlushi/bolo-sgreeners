-- =============================================================================
-- Scheda giocatore (altezza, mano), compleanni senza anno e feedback degli utenti.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Caratteristiche del giocatore (pubbliche)
-- ---------------------------------------------------------------------------
alter table public.players
  add column height_cm smallint check (height_cm between 120 and 240),
  add column hand text check (hand in ('destro', 'mancino'));

-- ---------------------------------------------------------------------------
-- Compleanni: per alcuni si conosce solo giorno e mese. birth_date resta una data
-- (anno 2000, bisestile, se l'anno non è noto) e birth_year_known lo segnala.
-- ---------------------------------------------------------------------------
alter table public.private_profiles
  add column birth_year_known boolean not null default true,
  -- esentato dai turni delle paste (porta solo quelle del compleanno)
  add column paste_exempt boolean not null default false;

-- ---------------------------------------------------------------------------
-- Feedback: idee e segnalazioni dal sito. Chiunque può scriverne uno,
-- solo gli admin li leggono e li gestiscono.
-- ---------------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'idea' check (kind in ('idea', 'problema', 'altro')),
  message text not null check (char_length(message) between 3 and 2000),
  contact text check (char_length(contact) <= 200),
  page text check (char_length(page) <= 300),
  user_agent text check (char_length(user_agent) <= 400),
  user_id uuid default auth.uid(),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  admin_notes text,
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
create policy "feedback_insert" on public.feedback
  for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and (user_id is null or user_id = (select auth.uid())));
create policy "feedback_admin_all" on public.feedback
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
