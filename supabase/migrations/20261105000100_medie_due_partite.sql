-- Medie già dopo 2 partite (prima 4): a inizio stagione le classifiche delle medie restavano vuote.
update public.stat_definitions set min_games = 2 where kind = 'per_game' and min_games = 4;

-- Per 30 minuti: stesse 2 partite e 60 minuti in campo (prima 4 partite e 100 minuti)
update public.stat_definitions set min_games = 2, min_minutes = 60 where kind = 'per_30';

-- Media stoppate, per i leader della stagione (punti, rimbalzi, assist, recuperi, stoppate)
insert into public.stat_definitions
  (key, label, short_label, category, kind, column_name, decimals, higher_is_better, show_in_leaderboards, min_games, sort_order)
values
  ('bpg', 'Media stoppate', 'STP/G', 'defense', 'per_game', 'blk', 1, true, true, 2, 53)
on conflict (key) do nothing;
