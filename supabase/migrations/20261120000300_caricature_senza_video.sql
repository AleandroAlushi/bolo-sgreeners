-- Stagione 2026-27: chi non c'era alle riprese dei video in loop ha la caricatura come foto di
-- stagione, così la sua figurina non resta vuota. Giocatori: King (Biscarini), J (Giordani),
-- Triso (Trisolini). Staff: Peppo (Pietro Venturi).
update public.season_rosters r
set photo_path = p.photo_path, avatar_crop = p.avatar_crop
from public.players p, public.seasons s
where s.slug = '2026-27' and r.season_id = s.id and r.player_id = p.id
  and p.slug in ('tommaso-biscarini', 'francesco-giordani', 'simone-trisolini')
  and p.photo_path is not null;

update public.season_staff ss
set photo_path = sm.photo_path
from public.staff_members sm, public.seasons s
where s.slug = '2026-27' and ss.season_id = s.id and ss.staff_id = sm.id
  and sm.slug = 'pietro-venturi'
  and sm.photo_path is not null;
