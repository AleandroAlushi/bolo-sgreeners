-- =============================================================================
-- Grafiche Instagram automatiche.
-- teams.code: la sigla di tre lettere delle grafiche ("BSG VS POR"). Vuota = ricavata dal nome.
-- private_profiles.instagram: il profilo da taggare nella didascalia (es. l'MVP). Dato
-- riservato: lo leggono solo admin e squadra, come il resto di private_profiles.
-- =============================================================================
alter table public.teams add column code text check (code ~ '^[A-Z0-9]{2,4}$');
update public.teams set code = 'BSG' where is_own_team and code is null;

alter table public.private_profiles add column instagram text check (instagram ~ '^[a-z0-9._]{1,30}$');
