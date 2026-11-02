-- Mano del giocatore: oltre a destro e mancino anche "mistero" (scelta della squadra).
alter table public.players drop constraint if exists players_hand_check;
alter table public.players
  add constraint players_hand_check check (hand in ('destro', 'mancino', 'mistero'));
