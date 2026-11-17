-- "Loud ass brick": un tiro sbagliato può essere segnato come brick (airball, tabellata...).
-- Nelle statistiche resta un errore normale; serve solo al contatore della diretta (battuta della squadra).
alter table public.live_events add column brick boolean not null default false;
