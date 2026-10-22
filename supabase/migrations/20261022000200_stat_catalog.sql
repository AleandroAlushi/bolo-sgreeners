-- =============================================================================
-- Catalogo delle statistiche e delle classifiche (leaderboard).
-- Aggiungere o modificare una categoria = aggiungere/modificare una riga, senza
-- toccare il codice dell'app. Le colonne referenziate devono esistere nelle view
-- v_player_*_totals (vedi migration 0300).
-- =============================================================================

create table public.stat_definitions (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  label text not null,
  short_label text not null,
  description text,
  category text not null check (category in ('presence', 'scoring', 'shooting', 'rebounding', 'playmaking', 'defense', 'discipline', 'impact')),
  -- total: somma; per_game: somma / partite in cui la statistica è registrata;
  -- percentage: numeratore / denominatore
  kind text not null check (kind in ('total', 'per_game', 'percentage')),
  column_name text,
  numerator_column text,
  denominator_column text,
  decimals integer not null default 0 check (decimals between 0 and 3),
  higher_is_better boolean not null default true,
  show_in_leaderboards boolean not null default true,
  show_in_box_score boolean not null default false,
  -- soglie minime per entrare in classifica (evitano che un 1/1 valga il primo posto)
  min_games integer not null default 0 check (min_games >= 0),
  min_attempts integer not null default 0 check (min_attempts >= 0),
  sort_order integer not null default 100,
  check (
    (kind in ('total', 'per_game') and column_name is not null)
    or (kind = 'percentage' and numerator_column is not null and denominator_column is not null)
  )
);

create table public.stat_columns (
  -- colonne aggregabili esposte dalle view dei totali: whitelist usata dall'app
  column_name text primary key check (column_name ~ '^[a-z0-9_]+$')
);

insert into public.stat_columns (column_name) values
  ('games'), ('minutes'), ('points'), ('fgm'), ('fga'), ('fg2m'), ('fg2a'), ('fg3m'), ('fg3a'),
  ('ftm'), ('fta'), ('oreb'), ('dreb'), ('reb'), ('ast'), ('stl'), ('tov'), ('blk'), ('pf'), ('plus_minus');

alter table public.stat_definitions
  add constraint stat_definitions_column_fk foreign key (column_name) references public.stat_columns (column_name),
  add constraint stat_definitions_num_fk foreign key (numerator_column) references public.stat_columns (column_name),
  add constraint stat_definitions_den_fk foreign key (denominator_column) references public.stat_columns (column_name);

insert into public.stat_definitions
  (key, label, short_label, category, kind, column_name, numerator_column, denominator_column, decimals, higher_is_better, show_in_leaderboards, min_games, min_attempts, sort_order)
values
  ('games',      'Presenze',                  'PG',   'presence',   'total',      'games',   null,   null,   0, true,  true,  0, 0,  10),
  ('points',     'Punti',                     'PTS',  'scoring',    'total',      'points',  null,   null,   0, true,  true,  0, 0,  20),
  ('ppg',        'Media punti',               'PPG',  'scoring',    'per_game',   'points',  null,   null,   1, true,  true,  4, 0,  21),
  ('reb',        'Rimbalzi',                  'REB',  'rebounding', 'total',      'reb',     null,   null,   0, true,  true,  0, 0,  30),
  ('rpg',        'Media rimbalzi',            'RPG',  'rebounding', 'per_game',   'reb',     null,   null,   1, true,  true,  4, 0,  31),
  ('oreb',       'Rimbalzi offensivi',        'OREB', 'rebounding', 'total',      'oreb',    null,   null,   0, true,  true,  0, 0,  32),
  ('dreb',       'Rimbalzi difensivi',        'DREB', 'rebounding', 'total',      'dreb',    null,   null,   0, true,  true,  0, 0,  33),
  ('ast',        'Assist',                    'AST',  'playmaking', 'total',      'ast',     null,   null,   0, true,  true,  0, 0,  40),
  ('apg',        'Media assist',              'APG',  'playmaking', 'per_game',   'ast',     null,   null,   1, true,  true,  4, 0,  41),
  ('stl',        'Palle recuperate',          'REC',  'defense',    'total',      'stl',     null,   null,   0, true,  true,  0, 0,  50),
  ('spg',        'Media recuperi',            'REC/G', 'defense',    'per_game',   'stl',     null,   null,   1, true,  true,  4, 0,  51),
  ('blk',        'Stoppate',                  'STP',  'defense',    'total',      'blk',     null,   null,   0, true,  true,  0, 0,  52),
  ('fg3m',       'Triple segnate',            '3PM',  'shooting',   'total',      'fg3m',    null,   null,   0, true,  true,  0, 0,  60),
  ('fg_pct',     '% al tiro dal campo',       'FG%',  'shooting',   'percentage', null,      'fgm',  'fga',  1, true,  true,  0, 30, 61),
  ('fg2_pct',    '% da 2 punti',              '2P%',  'shooting',   'percentage', null,      'fg2m', 'fg2a', 1, true,  true,  0, 20, 62),
  ('fg3_pct',    '% da 3 punti',              '3P%',  'shooting',   'percentage', null,      'fg3m', 'fg3a', 1, true,  true,  0, 15, 63),
  ('ft_pct',     '% ai tiri liberi',          'TL%',  'shooting',   'percentage', null,      'ftm',  'fta',  1, true,  true,  0, 10, 64),
  ('ftm',        'Tiri liberi segnati',       'TLM',  'shooting',   'total',      'ftm',     null,   null,   0, true,  true,  0, 0,  65),
  ('minutes',    'Minuti giocati',            'MIN',  'presence',   'total',      'minutes', null,   null,   0, true,  true,  0, 0,  70),
  ('mpg',        'Minuti a partita',          'MPG',  'presence',   'per_game',   'minutes', null,   null,   1, true,  true,  4, 0,  71),
  ('plus_minus', 'Plus/minus',                '+/-',  'impact',     'total',      'plus_minus', null, null,  0, true,  true,  0, 0,  80),
  ('tov',        'Palle perse',               'PP',   'discipline', 'total',      'tov',     null,   null,   0, false, false, 0, 0,  90),
  ('pf',         'Falli commessi',            'FALLI','discipline', 'total',      'pf',      null,   null,   0, false, false, 0, 0,  91);
