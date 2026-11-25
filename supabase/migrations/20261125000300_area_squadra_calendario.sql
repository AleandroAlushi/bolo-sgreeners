-- Area squadra: calendario mensile (allenamenti con orario, partite, compleanni, paste) e turni
-- delle paste con chi le ha già portate.

-- orari degli allenamenti per giorno della settimana (ISO: 1 = lunedì … 7 = domenica)
alter table public.training_schedule
  add column times jsonb not null default '{"1": ["22:00", "23:30"], "4": ["21:30", "23:00"]}'::jsonb;

-- stagione in cui ha già portato le paste (es. '2026-27'): nell'area squadra compare "Portate"
alter table public.private_profiles add column paste_done_season text;

-- soprannome dello staff, come per i giocatori (nel calendario: "Auguri Peppo")
alter table public.staff_members add column nickname text;
update public.staff_members set nickname = 'Peppo' where slug = 'pietro-venturi';
update public.staff_members set nickname = 'Cassa' where slug = 'francesco-cassanelli';

-- ---------------------------------------------------------------------------
-- Pausa di Pasqua: ci si allena in una scuola, chiusa dal 25 al 30 marzo 2027
-- (calendario scolastico dell'Emilia-Romagna)
-- ---------------------------------------------------------------------------
insert into public.training_breaks (season_id, start_date, end_date, label)
select s.id, '2027-03-25', '2027-03-30', 'Vacanze di Pasqua'
from public.seasons s
where s.slug = '2026-27'
  and not exists (
    select 1 from public.training_breaks b
    where b.season_id = s.id and b.start_date <= '2027-03-30' and b.end_date >= '2027-03-25'
  );

-- ---------------------------------------------------------------------------
-- Turni delle paste 2026-27 (decisi il 25/11/2026): prima chi è in arretrato (entro Natale),
-- poi distribuiti fino a fine maggio, vicino al compleanno quando cade in stagione; chi è nato
-- d'estate in primavera; J al rientro. Ogni giorno è un allenamento libero: se diventa giorno
-- di partita, il turno slitta al primo allenamento utile.
-- ---------------------------------------------------------------------------
update public.private_profiles pp
set paste_day = v.day
from (values
  ('luca-biolchini', '11-26'),
  ('matteo-mazzanti', '12-07'),
  ('filippo-corriere', '12-17'),
  ('tommaso-pedretti', '12-21'),
  ('tommaso-biscarini', '01-11'),
  ('simone-venturi', '01-21'),
  ('filippo-bertuzzi', '02-11'),
  ('andrea-maccaferri', '02-25'),
  ('francesco-giordani', '03-11'),
  ('davide-nanni', '03-22'),
  ('simone-trisolini', '04-05'),
  ('samuele-morando', '04-15'),
  ('gianmarco-tomba', '04-26'),
  ('francesco-carini', '05-13'),
  ('marcello-lagna', '05-27')
) as v (slug, day)
join public.players p on p.slug = v.slug
where pp.player_id = p.id;

update public.private_profiles pp
set paste_day = v.day
from (values
  ('pietro-venturi', '12-10'),
  ('cesare-betti', '05-06'),
  ('aleandro-alushi', '05-20')
) as v (slug, day)
join public.staff_members sm on sm.slug = v.slug
where pp.staff_id = sm.id or (sm.player_id is not null and pp.player_id = sm.player_id);

-- già portate quest'anno: Cassa e Chicco
update public.private_profiles pp set paste_done_season = '2026-27'
from public.staff_members sm
where sm.slug = 'francesco-cassanelli' and (pp.staff_id = sm.id or (sm.player_id is not null and pp.player_id = sm.player_id));
update public.private_profiles pp set paste_done_season = '2026-27'
from public.players p
where p.slug = 'federico-hrvatin' and pp.player_id = p.id;
