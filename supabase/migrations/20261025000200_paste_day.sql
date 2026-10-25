-- Paste: ognuno le porta una volta l'anno, nel suo giorno ("mm-gg", riservato alla squadra).
alter table public.private_profiles
  add column paste_day text check (paste_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
