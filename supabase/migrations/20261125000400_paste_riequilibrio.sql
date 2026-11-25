-- Turni delle paste 2026-27 riequilibrati (25/11/2026): 3 per mese da dicembre a maggio.
-- Vicino al compleanno chi lo compie in stagione (Teo il giorno dopo, Simo, Macca, Dede, Triso);
-- chi l'ha già compiuto o è nato d'estate riempie i mesi con meno turni. J ad aprile (a marzo
-- forse non è ancora a Bologna), Biolco a marzo.
update public.private_profiles pp
set paste_day = v.day
from (values
  ('matteo-mazzanti', '12-07'),
  ('filippo-corriere', '12-17'),
  ('tommaso-pedretti', '01-07'),
  ('tommaso-biscarini', '01-14'),
  ('simone-venturi', '01-21'),
  ('filippo-bertuzzi', '02-04'),
  ('samuele-morando', '02-15'),
  ('andrea-maccaferri', '02-25'),
  ('luca-biolchini', '03-04'),
  ('gianmarco-tomba', '03-11'),
  ('davide-nanni', '03-22'),
  ('simone-trisolini', '04-05'),
  ('francesco-giordani', '04-15'),
  ('francesco-carini', '05-06'),
  ('marcello-lagna', '05-27')
) as v (slug, day)
join public.players p on p.slug = v.slug
where pp.player_id = p.id;

update public.private_profiles pp
set paste_day = v.day
from (values
  ('pietro-venturi', '12-10'),
  ('cesare-betti', '04-26'),
  ('aleandro-alushi', '05-17')
) as v (slug, day)
join public.staff_members sm on sm.slug = v.slug
where pp.staff_id = sm.id or (sm.player_id is not null and pp.player_id = sm.player_id);
