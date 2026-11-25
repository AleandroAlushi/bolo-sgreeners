-- Giocatore lontano per un periodo (es. J in viaggio fino a febbraio): nella pagina Squadra la sua
-- figurina è più scura, con un aeroplanino e la nota ("Torna a febbraio"). Dopo `away_until`
-- torna normale da sola.
alter table public.season_rosters
  add column away_until date,
  add column away_note text check (char_length(away_note) <= 40);

comment on column public.season_rosters.away_until is 'Lontano dalla squadra fino a questa data (figurina più scura con l''aeroplanino)';
comment on column public.season_rosters.away_note is 'Nota breve sulla figurina, es. "Torna a febbraio"';

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
  r.photo_path as season_photo_path,
  r.video_path as season_video_path,
  r.away_until,
  r.away_note
from public.season_rosters r
join public.seasons s on s.id = r.season_id
join public.players p on p.id = r.player_id
left join public.v_player_season_totals t
  on t.player_id = r.player_id and t.season_id = r.season_id and t.basis = 'match_data';

-- J (Francesco Giordani) è in viaggio: torna a febbraio 2027
update public.season_rosters r
set away_until = '2027-02-28', away_note = 'Torna a febbraio'
from public.players p, public.seasons s
where p.slug = 'francesco-giordani' and s.slug = '2026-27' and r.player_id = p.id and r.season_id = s.id;
