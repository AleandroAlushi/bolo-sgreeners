-- Chi è sia giocatore sia staff (oggi Aleandro Alushi, statistiche): è una persona sola.
-- La caricatura dello staff diventa anche la sua foto da giocatore (tondino, statistiche) e la
-- foto delle stagioni in cui era nel roster senza una foto sua.

-- 1. foto predefinita del giocatore = foto dello staff, se il giocatore non ne ha una
update public.players p
set photo_path = sm.photo_path
from public.staff_members sm
where sm.player_id = p.id and p.photo_path is null and sm.photo_path is not null;

-- ritaglio del viso del tondino sulla caricatura di Aleandro (frazioni della larghezza)
update public.players
set avatar_crop = '{"x": 0.31, "y": 0.09, "s": 0.56}'::jsonb
where slug = 'aleandro-alushi' and avatar_crop is null and photo_path like 'staff/%';

-- 2. foto di stagione nel roster = quella dello staff nella stessa stagione, se manca
update public.season_rosters r
set photo_path = ss.photo_path, avatar_crop = p.avatar_crop
from public.staff_members sm
join public.season_staff ss on ss.staff_id = sm.id
join public.players p on p.id = sm.player_id
where sm.player_id = r.player_id and ss.season_id = r.season_id
  and r.photo_path is null and r.video_path is null and ss.photo_path is not null;
