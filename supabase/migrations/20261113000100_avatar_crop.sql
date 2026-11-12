-- Ritaglio del viso per il tondino del giocatore (avatar): { "x", "y", "s" } in frazioni della
-- LARGHEZZA della foto (angolo in alto a sinistra e lato del quadrato). Calcolato con
-- scripts/photos/avatar-crops.cjs (rilevamento del viso); senza ritaglio il tondino mostra la
-- parte alta della foto.
alter table public.season_rosters add column avatar_crop jsonb
  check (avatar_crop is null or (avatar_crop ? 'x' and avatar_crop ? 'y' and avatar_crop ? 's'));

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
  -- ritaglio del viso per il tondino (solo se la foto è quella di stagione)
  case when r.photo_path is not null then r.avatar_crop end as avatar_crop
from public.season_rosters r
join public.seasons s on s.id = r.season_id
join public.players p on p.id = r.player_id
left join public.v_player_season_totals t
  on t.player_id = r.player_id and t.season_id = r.season_id and t.basis = 'match_data';
