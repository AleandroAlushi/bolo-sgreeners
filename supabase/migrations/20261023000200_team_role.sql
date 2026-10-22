-- Ruolo "squadra": giocatori e staff con un account in sola lettura, che vedono anche i dati
-- riservati (date di nascita, paste, allenamenti). In un file a sé perché un nuovo valore di
-- enum non si può usare nella stessa transazione in cui viene aggiunto.
alter type public.app_role add value if not exists 'team';
