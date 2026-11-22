-- Ruolo "stats" (Statistiche): chi prende le statistiche a bordo campo, oggi Pietro "Peppo".
-- Può fare la diretta e salvare il box score (come la squadra), vedere "Oggi" e fare le grafiche,
-- caricando le loro foto; non può modificare roster, partite, classifiche e stagioni.
-- Il ruolo si assegna in Admin → Area squadra → Accessi. In un file a sé perché un nuovo valore
-- di enum non si può usare nella stessa transazione in cui viene aggiunto (permessi nel file dopo).
alter type public.app_role add value if not exists 'stats';
