-- Caricature: dalla stagione 2026-27 alla 2025-26, e foto predefinita di ogni persona.
--
-- Le caricature erano le foto di stagione 2026-27. Da ora:
--   * sono la foto PREDEFINITA del giocatore (players.photo_path, con il ritaglio del viso in
--     players.avatar_crop) e dello staff (staff_members.photo_path): tondino, statistiche,
--     leaderboard, diretta, grafiche;
--   * sono la foto di stagione 2025-26 di chi era nel roster o nello staff 2025-26;
--   * la stagione 2026-27 resta senza foto di stagione (lì arriveranno le GIF).
-- Chi non era nella 2025-26 (nuovi arrivi) ha la caricatura solo come foto predefinita.

alter table public.players add column avatar_crop jsonb
  check (avatar_crop is null or (avatar_crop ? 'x' and avatar_crop ? 's' and avatar_crop ? 'y'));

-- 1. foto predefinita = caricatura 2026-27 (stesso file, stesso ritaglio)
update public.players p
set photo_path = r.photo_path, avatar_crop = r.avatar_crop
from public.season_rosters r
join public.seasons s on s.id = r.season_id
where s.slug = '2026-27' and r.player_id = p.id and r.photo_path is not null;

update public.staff_members sm
set photo_path = x.photo_path
from (
  select distinct on (ss.staff_id) ss.staff_id, ss.photo_path
  from public.season_staff ss
  join public.seasons s on s.id = ss.season_id
  where s.slug = '2026-27' and ss.photo_path is not null
  order by ss.staff_id, ss.sort_order
) x
where x.staff_id = sm.id;

-- 2. foto di stagione 2025-26 = caricatura, per chi c'era
update public.season_rosters old
set photo_path = cur.photo_path, avatar_crop = cur.avatar_crop
from public.season_rosters cur, public.seasons s_old, public.seasons s_cur
where s_old.slug = '2025-26' and s_cur.slug = '2026-27'
  and old.season_id = s_old.id and cur.season_id = s_cur.id
  and old.player_id = cur.player_id and cur.photo_path is not null;

update public.season_staff old
set photo_path = x.photo_path
from (
  select distinct on (ss.staff_id) ss.staff_id, ss.photo_path
  from public.season_staff ss
  join public.seasons s on s.id = ss.season_id
  where s.slug = '2026-27' and ss.photo_path is not null
  order by ss.staff_id, ss.sort_order
) x, public.seasons s_old
where s_old.slug = '2025-26' and old.season_id = s_old.id and old.staff_id = x.staff_id;

-- 3. stagione 2026-27 senza foto di stagione
update public.season_rosters r set photo_path = null, avatar_crop = null
from public.seasons s where s.id = r.season_id and s.slug = '2026-27';

update public.season_staff ss set photo_path = null
from public.seasons s where s.id = ss.season_id and s.slug = '2026-27';

-- 4. viste: photo_path resta "la foto da mostrare" (di stagione, altrimenti quella predefinita),
--    con il ritaglio giusto; season_photo_path è solo la foto di quella stagione (pagina Squadra,
--    pagina Staff, foto delle stagioni nel profilo).
create or replace view public.v_season_roster with (security_invoker = true) as
select
  r.season_id,
  s.slug as season_slug,
  r.player_id,
  p.slug as player_slug,
  p.first_name,
  p.last_name,
  p.display_name,
  coalesce(r.nickname, p.nickname) as nickname,
  r.jersey_number,
  r.role,
  r.is_active,
  r.is_captain,
  coalesce(r.photo_path, p.photo_path) as photo_path,
  coalesce(t.games, 0) as games,
  r.is_vice_captain,
  -- prima stagione con la squadra (badge "nuovo arrivo")
  (select min(s2.slug) from public.season_rosters r2 join public.seasons s2 on s2.id = r2.season_id
    where r2.player_id = r.player_id) as first_season_slug,
  -- ruolo nello staff nella stessa stagione (chi è dello staff e gioca quando serve)
  (select string_agg(ss.role, ', ' order by ss.sort_order) from public.staff_members sm
    join public.season_staff ss on ss.staff_id = sm.id and ss.season_id = r.season_id
    where sm.player_id = r.player_id) as staff_role,
  -- ritaglio del viso per il tondino, della foto mostrata in photo_path
  case when r.photo_path is not null then r.avatar_crop else p.avatar_crop end as avatar_crop,
  r.photo_path as season_photo_path
from public.season_rosters r
join public.seasons s on s.id = r.season_id
join public.players p on p.id = r.player_id
left join public.v_player_season_totals t
  on t.player_id = r.player_id and t.season_id = r.season_id and t.basis = 'match_data';

create or replace view public.v_season_staff with (security_invoker = true) as
select
  ss.season_id,
  s.slug as season_slug,
  sm.id as staff_id,
  sm.slug,
  sm.first_name,
  sm.last_name,
  sm.display_name,
  coalesce(ss.photo_path, sm.photo_path, p.photo_path) as photo_path,
  ss.role,
  ss.sort_order,
  sm.player_id,
  p.slug as player_slug,
  coalesce(t.games, 0) as games_as_player,
  ss.photo_path as season_photo_path
from public.season_staff ss
join public.seasons s on s.id = ss.season_id
join public.staff_members sm on sm.id = ss.staff_id
left join public.players p on p.id = sm.player_id
left join public.v_player_season_totals t
  on t.player_id = sm.player_id and t.season_id = ss.season_id and t.basis = 'match_data';
