# Architettura — Bolo Sgreeners V1

## Stack

| Livello | Scelta | Note |
| --- | --- | --- |
| Frontend | **Next.js 16** (App Router, Cache Components, Turbopack), React 19, TypeScript | pagine pubbliche prerenderizzate e messe in cache; admin dinamico |
| Stile | **Tailwind CSS 4** + design token in `src/app/globals.css` | niente component library: pochi componenti su misura, nessuna dipendenza in più |
| Database | **Supabase** (PostgreSQL 17, Auth, Storage) | migrations versionate in `supabase/migrations` |
| Validazione | **zod** | form admin e conferma import |
| Parsing HTML | **node-html-parser** | leggero, nessun DOM completo |
| Excel (solo script) | **exceljs** | dev-dependency, mai nel bundle dell'app |
| Test | **vitest** | parser, mapping, classifica, leaderboard |
| Deploy | **Vercel** | |

Unica deviazione dalla specifica: niente shadcn/ui. I componenti necessari sono pochi
(card, badge, tabelle con colonna fissa, form admin) e restano più leggeri scritti a mano.

## Flusso dei dati

```
Fonti originali ──► estrazione ──► normalizzazione ──► mapping ──► validazione ──► persistenza ──► view ──► pagine
(HTML, Excel,       (per fonte)     (nomi, numeri,      (alias)     (problemi,      (funzione SQL   (aggregati
 CSI curato)                         date, assenze)                   conflitti)      import_match_    calcolati)
                                                                                      report / upsert)
```

- **Parser** (`src/lib/importers/`) indipendente dal database: `parseMatchHtml()` →
  `NormalizedMatchReport`; `matchPlayerAlias()` / `mapPlayers()`; `validateImportedMatch()`;
  `buildMatchReportPayload()`.
- **Persistenza**: la funzione SQL `public.import_match_report(payload jsonb)` scrive tutto in una
  transazione. La usano sia l'admin (`/admin/import`) sia lo script storico: un solo percorso.
- **Il frontend legge solo dal database**, tramite le funzioni in `src/lib/data/` (nessuna query
  sparsa nelle pagine).

## Schema del database

```
seasons ─┬─< competitions ─┬─< competition_teams >── teams ──< team_aliases
         │                 ├── standings_rules
         │                 ├─< standings_adjustments
         │                 ├─< official_standings
         │                 └─< matches ─┬─< match_period_scores
         │                              ├─< player_match_stats >── players ──< player_aliases
         │                              ├─< team_match_stats
         │                              ├─< match_awards >── players (MVP)
         │                              └── venues
         ├─< season_rosters >── players
         ├─< season_staff >── staff_members ··· players (staff che gioca)
         ├── training_schedule
         ├─< training_breaks
         └─< player_season_aggregates (solo storico senza dettaglio partita)

private_profiles ── date di nascita di giocatori e staff (riservate), anche senza anno; esenzione dai turni paste
feedback ── idee e segnalazioni dal sito (scrive chiunque, legge solo l'admin)
data_sources ◄── (source_id su partite, risultati, statistiche, parziali, roster, alias, staff...)
imports      ◄── audit di ogni import (file, hash, parser, versione, stato, errori, payload)
source_conflicts ── discrepanze tra fonti (mai risolte in silenzio)
stat_definitions / stat_columns ── catalogo statistiche e classifiche
user_roles ── ruolo admin | team
```

Scelte principali:

- **Squadra = identità stabile**, il nome ufficiale (che cambia con gli sponsor, es.
  "Revolution - Bolo Sgreeners") sta in `competition_teams.display_name`.
- **Giocatore = identità unica**; numero, ruolo, soprannome, stato, capitano e vice capitano
  per stagione in `season_rosters`; il numero è salvato anche su ogni riga partita perché cambia
  (Lil #37 → #7). Il sito mostra il numero principale della stagione (`season_rosters`); quello
  indossato davvero (maglie prestate) resta in `v_player_game_lines.worn_jersey_number`.
- **Staff**: `staff_members` (anagrafica, foto, eventuale `player_id` per chi è anche giocatore)
  e `season_staff` (ruolo per stagione, più ruoli possibili). Arriva da *Admin → Staff* o da
  `data/curated/staff.json` tramite l'import storico.
- **Scheda giocatore**: `players.height_cm` e `players.hand` (destro/mancino), pubblici. Le date
  di nascita stanno in `private_profiles`: se si conosce solo giorno e mese `birth_date` è
  nell'anno 2000 e `birth_year_known` è false.
- **Roster**: nelle stagioni con partite contiene solo chi ha giocato almeno una partita (l'import
  ignora chi è solo a referto o assente, e la pagina Squadra nasconde chi ha 0 partite a stagione
  finita); per la stagione appena iniziata lo indica la squadra in `data/curated/roster.json`.
- **MVP di partita**: `match_awards` (una riga per partita e premio, oggi solo `mvp`), scelto
  dalla squadra e inserito dall'admin.
- **Alias condizionali**: `player_aliases` può essere limitato a una stagione e/o a un numero di
  maglia ("Chicco" #32 = Hrvatin, #2 = Carini). Lo stesso alias su più giocatori ⇒ ambiguo.
- **Partite**: stato `scheduled | played | postponed | cancelled | forfeit` (enum estendibile),
  `verification` (`verified | probable | to_verify`) per gli avversari dedotti dai soprannomi,
  `home_away_confirmed` quando la fonte non dice chi era in casa.
- **Provenienza a livello di campo**: `schedule_source_id` e `result_source_id` sulle partite,
  `source_id` su statistiche, parziali, roster, alias, classifiche.
- **Classifica**: regole per competizione (`standings_rules`, nessun default inventato),
  penalizzazioni, classifica ufficiale salvata così com'è. La classifica si calcola in TypeScript
  (`src/lib/domain/standings.ts`) e si confronta con quella ufficiale; se mancano partite si mostra
  l'ufficiale.

### Statistiche flessibili (perché un mix)

- Le statistiche "classiche" del basket (minuti, punti, FG/3P/TL realizzati-tentati, rimbalzi
  offensivi/difensivi/totali, assist, recuperi, perse, stoppate, falli, +/-) sono **colonne
  tipizzate**: vincoli di coerenza nel DB (realizzati ≤ tentati, RT = RO + RD), aggregazioni SQL
  semplici e veloci.
- **`null` ≠ 0**: una statistica non registrata dalla fonte resta `null`; le medie usano come
  denominatore le partite in cui la statistica esiste (`<stat>_games` nelle view).
- Statistiche nuove o rare finiscono in `extra jsonb` senza perdita di dati; quando diventano
  stabili si promuovono a colonna con una migration.
- Le **classifiche** (leader) sono righe di `stat_definitions` (totale, media o percentuale, soglie
  minime di partite/tentativi): aggiungere una categoria non richiede codice.

### Dati derivati

Carriera, stagione, fase, medie, percentuali, record di squadra: **view** (`v_matches`,
`v_player_game_lines`, `v_player_competition_totals`, `v_player_season_totals`,
`v_player_career_totals`, `v_own_competition_records`, `v_season_roster`, `v_season_staff`),
tutte `security_invoker`. `v_season_roster` aggiunge per ogni giocatore la prima stagione con
la squadra (badge "nuovo arrivo") e l'eventuale ruolo nello staff. L'unica eccezione prevista è `player_season_aggregates` (Excel con soli
totali), marcata `basis = 'historical_aggregate'` e sommata alla carriera separatamente. Nelle
fonti attuali non serve: tutti gli Excel hanno il dettaglio partita.

## Sicurezza

- RLS su tutte le tabelle: lettura pubblica (anon) dei dati sportivi (compresi staff e MVP);
  scrittura solo se `public.is_admin()` (riga `admin` in `user_roles`).
- Ruoli (`app_role`): `admin` (gestione completa) e `team` (giocatori e staff, sola lettura dei
  dati riservati). Il valore `team` è aggiunto in una migration a sé, perché un nuovo valore di
  enum non si può usare nella stessa transazione.
- `imports`, `team_aliases` (soprannomi degli avversari, spesso volgari) e `source_conflicts` sono
  leggibili solo dagli admin.
- Storage: bucket `match-files` privato (file originali), bucket `media` pubblico (foto).
- La service role key serve solo agli script locali; l'app usa la chiave pubblica + sessione.
- **Area squadra**: ruolo `team` in `user_roles` (sola lettura). `private_profiles` (date di
  nascita), `training_schedule` e `training_breaks` sono leggibili solo se `is_team_member()`
  (admin o team) e scrivibili solo dagli admin. Le pagine pubbliche restano in cache e non
  contengono dati riservati: il compleanno nella scheda giocatore è un "buco" dinamico (dentro
  `<Suspense>`) letto con la sessione dell'utente. Gli accessi si assegnano con le funzioni
  `admin_set_role` / `admin_list_access` (security definer, solo admin; un admin non può
  togliersi il ruolo da solo). `feedback`: inserimento aperto a tutti (anon compreso, solo
  stato "nuovo" e senza note), lettura e modifica solo admin. La pagina `/area-squadra` è protetta lato server
  (`requireTeamSession`, `src/lib/team/`) oltre che dalla RLS; il login è `/area-squadra/accedi`.

## Import idempotente

1. **Hash SHA-256 del file**: indice unico sugli import completati. Lo stesso file ⇒ risposta
   `duplicate`, nessuna scrittura (il tentativo resta nell'audit).
2. **Partita con statistiche già presenti**: errore `match_already_imported`, a meno di conferma
   esplicita (*sovrascrivi*); le righe vecchie vengono sostituite e gli import precedenti marcati
   `superseded`.
3. Il file originale è conservato su Storage, con parser e versione: si potrà rielaborarlo.

## Rendering e cache

- Pagine pubbliche: `"use cache"` sulle funzioni dati (`cacheLife("hours")`,
  `cacheTag("sgreeners-data")`), `generateStaticParams` per stagioni, giocatori e partite.
- Ogni scrittura admin chiama `updateTag("sgreeners-data")`: le pagine si aggiornano subito.
  Le scritture fatte fuori dall'app (SQL, script) compaiono entro un'ora o al deploy successivo.
- Area admin: sempre dinamica (`connection()` + cookie di sessione), protetta lato server
  (`requireAdmin`) e dalla RLS.
- **Grafiche** (`src/app/grafiche/`): route handler che restituiscono PNG con `ImageResponse`
  di `next/og` (partita = Final Score o Game day, presentazione, tifosi, tabellino, mvp,
  calendario del mese), con `?formato=post` 1080×1350 o `storia` 1080×1920, `foto=` (file del
  bucket media caricato da *Admin → Grafiche*) e `titolo=`. Stile in
  `src/lib/graphics/theme.tsx`, modelli in `templates.tsx`, dati (con i loghi delle squadre) in
  `data.ts`; font (OFL), logo e texture in `assets/`.

## Routing

```
/                                   home (stagione in evidenza, ultima/prossima, leader)
/stagioni                           archivio stagioni
/stagioni/[stagione]                panoramica (record, fasi, risultati, leader)
/stagioni/[stagione]/calendario     per giornata o per data
/stagioni/[stagione]/classifica     per competizione (calcolata o ufficiale)
/stagioni/[stagione]/squadra        roster a figurine (numero, ruolo, capitano/vice, nuovo arrivo, staff)
/stagioni/[stagione]/squadra/staff  staff della stagione
/stagioni/[stagione]/statistiche    leader + totali/medie, filtro per fase
/statistiche                        all time: tutte le stagioni, filtro per tipo di fase
/feedback                           idee e segnalazioni (le legge solo l'admin)
/giocatori                          tutti i giocatori
/giocatori/[slug]                   carriera, stagioni, fasi, record, partita per partita
/partite/[id]                       risultato, parziali, leader, MVP, box score, confronto squadre,
                                    fonti, download grafiche
/area-squadra                       compleanni e calendario delle paste (ruolo team o admin)
/area-squadra/accedi                login della squadra
/grafiche/partita/[id]              PNG "Final Score" (giocata) o "Game day" (?formato=post|storia)
/grafiche/mvp/[id]                  PNG "MVP" (?formato=post|storia)
/grafiche/presentazione/[id]        PNG "Game day"
/grafiche/tifosi/[id]               PNG chiamata ai tifosi (di default storia)
/grafiche/tabellino/[id]            PNG migliori, percentuali e marcatori dal box score
/grafiche/calendario/[stagione]     PNG partite del mese (?mese=aaaa-mm)
/admin/login
/admin                              dashboard + audit import + aggiornamento del sito pubblico
/admin/import                       wizard di import box score
/admin/partite, /admin/partite/nuova, /admin/partite/[id]   (correzione righe statistiche, MVP)
/admin/giocatori, /admin/giocatori/[id]                     (roster per stagione, alias, foto,
                                                             data di nascita)
/admin/staff                        staff per stagione (ruoli, foto, data di nascita)
/admin/area-squadra                 accessi (admin/team), allenamenti e pause
/admin/grafiche                     grafiche Instagram: partita, modello, formato, foto, titolo
/admin/feedback                     feedback degli utenti (nuovi, letti, fatti)
/admin/alias, /admin/stagioni, /admin/squadre, /admin/discrepanze
```

## Cartelle

```
src/app/(site)/        pagine pubbliche          src/lib/importers/   parser e pipeline di import
src/app/admin/         area admin                src/lib/data/        letture dal DB (cache)
src/app/grafiche/      grafiche PNG (next/og)    src/lib/domain/      logica pura (stat, classifica, formati, paste)
src/components/        componenti UI             src/lib/supabase/    client e tipi generati
src/lib/admin/         auth, server action       src/lib/team/        sessione e dati dell'area squadra
src/lib/graphics/      grafiche (stile, modelli) assets/              font OFL, logo e grana per le grafiche
src/lib/feedback/      invio dei feedback        data/private/        date di nascita (non committate)
supabase/migrations/   schema SQL                scripts/import-historical/  import storico
supabase/demo/         seed demo + eliminazione  scripts/local-db/    stack locale di test (senza Docker)
data/curated/          dati curati (CSI, roster, staff, discrepanze verificate)
docs/                  report fonti e architettura
tests/                 test vitest + fixture sintetiche
```

## Problemi noti / limiti della V1

- Nel database ci sono solo le partite degli Sgreeners: le classifiche mostrate sono quelle
  ufficiali del CSI (scaricate dal Livescore), non ricalcolate.
- Il grafico "Game Flow" degli export Easy Stats è solo un'immagine: non viene estratto.
- Gli shot chart (un solo file) sono conservati nel payload dell'import ma non ancora mostrati.
- Le correzioni manuali ripetute sulla stessa riga conservano nel registro solo l'ultima.
