# Funzionalità del sito

Cosa fa il sito, pagina per pagina, e dove si gestisce ogni cosa dall'admin.
Per la gestione tecnica (Livescore, import, Supabase, Vercel) vedi [GESTIONE.md](GESTIONE.md).

## Cosa fa

- **Sito pubblico**: home con stagione in evidenza, ultima/prossima partita e leader; archivio
  stagioni; per ogni stagione panoramica, calendario (per giornata o per data), classifica,
  squadra (roster a figurine e staff) e statistiche (leader con soglie minime, totali e medie,
  filtro per fase), più le statistiche **All time** di tutte le stagioni (`/statistiche`); pagina
  giocatore (carriera, stagioni, fasi, record personali, partita per partita, altezza e mano);
  pagina partita (punteggio, parziali, palestra, leader, MVP, box score, confronto squadre, fonti,
  grafiche da scaricare); schede delle altre squadre dalla classifica; area squadra riservata
  (compleanni, paste e statistiche live); **feedback** (`/feedback`: idee e segnalazioni che legge
  solo l'admin).
- **Area admin** (`/admin`), che si apre su **Oggi** (diretta da riprendere, prossima e ultima
  partita):
  - *Partita*: Oggi, Partite (correzione delle statistiche, MVP), Grafiche per Instagram;
  - *Squadra*: Giocatori e roster, Staff, Foto e video (caricature, video in loop, scontorni,
    foto in partita), Area squadra (accessi, allenamenti e pause);
  - *Campionato*: stagioni, competizioni, regole di classifica, penalizzazioni, squadre;
  - *Altro*: ricerca (`/admin/cerca`), feedback, **Archivio** (import dei box score HTML,
    discrepanze tra fonti, registro degli import).
  - Ruoli: `admin` vede tutto; `stats` solo diretta, Oggi e grafiche; `team` l'area squadra.
- **Import storico**: script che carica Excel, box score HTML e dati CSI curati, registrando la
  fonte di ogni dato e le discrepanze.

## Statistiche live dal sito

Al posto di Easy Stats si possono prendere le statistiche dal sito: **Area squadra → Statistiche
live** (o *Admin → Statistiche live*), da telefono o tablet. Si sceglie la partita, si spuntano i
convocati e si parte: quintetto, orologio (tocco per avviarlo e fermarlo), tiri segnati e sbagliati,
rimbalzi, assist, recuperi, perse, stoppate, falli e cambi, con "annulla" e registro. Ogni azione si
salva prima sul dispositivo e poi sul database (`live_games`, `live_events`): se in palestra manca
la rete non si perde niente.

Mentre si gioca, la pagina della partita mostra la **diretta** (punteggio, orologio, parziali,
andamento, tabellino con minuti e +/-, confronto squadre, aggiornati ogni 5 secondi) e la home una
striscia "LIVE". A fine partita *Termina partita → Salva box score* trasforma gli eventi nel box
score ufficiale con la stessa funzione dell'import HTML (`import_live_report` → `import_match_report`):
statistiche, medie e classifiche funzionano come con il file di Easy Stats. Possono prendere le
statistiche gli account della squadra (ruolo `team`) e gli admin.

## Notifiche push

Chi le attiva dalla home riceve una notifica il giorno della partita (dalle 9), un'ora prima e con
il risultato finale. Su Android e computer basta il browser; su iPhone solo dall'app aggiunta alla
schermata Home (iOS 16.4 o successivo). Le invia `npm run notify`, che gira subito dopo ogni
aggiornamento del Livescore (stesso workflow) e non ripete mai la stessa notifica (`push_log`).
Serve il secret `VAPID_PRIVATE_KEY` su GitHub; la chiave pubblica è in `src/lib/push.ts`. Perché
partano all'ora giusta, il job di cron-job.org deve girare anche alle 9 e dalle 18 (ore
`9, 18, 19, 20, 21, 22, 23, 0`).

## Squadra, staff e area riservata

- **Squadra** (`/stagioni/<stagione>/squadra`): roster a figurine (numero, ruolo, badge capitano,
  vice capitano, nuovo arrivo, staff) e scheda **Staff**. Ruoli, capitano e vice si impostano in
  *Admin → Giocatori*; lo staff in *Admin → Staff* (oppure in `data/curated/staff.json`,
  caricato dall'import storico). L'**MVP** di una partita si sceglie in *Admin → Partite*.
- **Foto per stagione**: ogni giocatore e membro dello staff può avere una foto diversa in ogni
  stagione (figurine della pagina Squadra, statistiche della stagione; la scheda giocatore usa la
  più recente). Si caricano una per una in *Admin → Giocatori* (riga della stagione) e *Admin →
  Staff*, oppure tutte insieme da una cartella:
  ```bash
  npm run photos:import -- --season=2023-24 --dir="/percorso/foto 2023-24" --dry-run
  npm run photos:import -- --season=2023-24 --dir="/percorso/foto 2023-24"
  ```
  Per ritoccare l'inquadratura di una figurina già caricata (ingrandire, rimpicciolire, centrare)
  senza la foto originale: `npm run photos:reframe -- regole.json --prova <cartella>` per le
  anteprime, poi senza `--prova` per caricarle (regole e opzioni nel commento di
  `scripts/photos/reframe.ts`).
  I file si abbinano dal nome ("Federico Hrvatin.jpg", "hrvatin.png", "Chicco.jpg"), vengono
  ridimensionati (JPG, max 900×1200) e caricati nel bucket `media`; `--update` sostituisce le foto
  già presenti. Le foto HEIC dell'iPhone vanno prima esportate in JPG.
- **Numero di maglia**: il sito mostra sempre il numero principale del giocatore nella stagione;
  per chi ha giocato con maglie prestate si indica in `data/curated/roster.json`.
- **Roster di una stagione**: nelle stagioni con partite si ricava dai box score e comprende solo
  chi ha giocato almeno una partita; le eccezioni (chi era in rosa senza mai giocare, es. Apo nel
  2023-24 perché infortunato) si indicano in `data/curated/roster.json` → `seasons` con `notes`. Per una stagione appena iniziata il roster (numeri e ruoli) si indica in
  `data/curated/roster.json` → `seasons`, insieme a soprannome, altezza e mano di ciascuno e ai
  giocatori nuovi; lo staff per stagione in `data/curated/staff.json`. Chi è staff e gioca (es.
  Aleandro Alushi) compare tra i giocatori solo nelle stagioni in cui ha giocato.
- **Date di nascita**: sono dati riservati, quindi non stanno nei file committati ma in
  `data/private/profiles.json` (cartella esclusa da git), letto dall'import storico. Per chi ha
  solo giorno e mese si usa `birthday: "mm-gg"`.
- **Area squadra** (`/area-squadra`, link con il lucchetto): compleanni e calendario delle **paste**:
  ognuno le porta **una volta l'anno**, nel suo giorno (lo stesso della stagione precedente,
  "giorno delle paste" nella scheda admin o `paste` in `data/private/profiles.json`), al primo
  allenamento utile da quel giorno. Gli allenamenti (default lunedì e giovedì) escludono le pause
  (`data/curated/training.json` o *Admin → Area squadra*) e i giorni di partita, in casa e in
  trasferta. Chi non ha ancora un giorno è "da impostare"; chi è *esente* non porta le paste. È visibile solo
  agli account con ruolo *squadra* (giocatori e staff, sola lettura) e agli admin; i visitatori non
  vedono né la pagina né le date di nascita, neanche nelle schede giocatore (protezione nel database
  con la RLS, non solo nell'interfaccia).

- **Grafiche per Instagram**, pronte da *Admin → Grafiche* (all'apertura c'è la partita di oggi,
  altrimenti la prossima):
  - *prima della partita*: **presentazione** in post (1080×1350) e storia (1080×1920): sigle
    giganti "BSG VS POR" (**AT** in trasferta), loghi delle due squadre in alto, giorno, ora e
    palestra (nella storia); foto facoltativa nella colonna colorata, tinta in automatico. Con la
    didascalia "Game day" da copiare.
  - *dopo la partita* (serve il box score importato): carosello **Finale** (punteggio e loghi),
    **MVP** (quello indicato nella partita, altrimenti il migliore per valutazione: punti +
    rimbalzi + assist + recuperi + stoppate − tiri sbagliati − palle perse; foto del roster o
    caricata), **Box score** (punti, rimbalzi, assist, recuperi) e **Leader della partita** con le
    giocatori scontornati. La didascalia si scrive dai numeri: titolo ("Buona la prima in casa ✅"),
    record, "Primo #mvp del match per @…" (profilo Instagram dai dati riservati del giocatore),
    due righe sulla partita e la prossima gara. È una bozza: si modifica e si copia.
  - **scontorni**: in fondo alla pagina, per ogni giocatore della stagione, lo scontorno (PNG
    trasparente) ricavato nel browser dell'admin con MediaPipe (modello "selfie multiclass",
    Apache 2.0, scaricato da Google alla prima volta) dalla foto della stagione o da un'altra foto
    caricata lì; si salva in `season_rosters.cutout_path`. MVP e leader usano lo scontorno se c'è
    (nei leader solo il mezzobusto), altrimenti la foto della stagione in un riquadro sfumato. Anche
    la foto dell'MVP caricata per una partita viene scontornata.
  - restano *Chiamata ai tifosi* e *Calendario del mese* nello stile precedente.
  Sigla (3 lettere) e logo degli avversari si impostano in *Admin → Squadre* (sigla vuota =
  ricavata dal nome; loghi anche con `npm run livescore:logos`). Le route `/grafiche` rispondono
  401 a chi non è admin. Codice in `src/lib/graphics/social/` (sfondi disegnati in codice con
  Satori, foto preparate con sharp); prova senza database: `npx tsx scripts/graphics-preview.tsx
  <cartella> [foto.jpg]` con `NODE_OPTIONS=--conditions=react-server`. Font in `assets/fonts`
  (licenza OFL).
- **Indicazioni e calendario**: nella pagina di ogni partita
  il pulsante **Indicazioni** apre la palestra in Mappe (Apple), Google Maps o Waze, e **Aggiungi al
  calendario** la mette in Apple Calendar, Google Calendar o Outlook (`/ics/partita/<id>`). Nel
  calendario della stagione **Aggiungi tutto il calendario** iscrive a tutte le partite
  (`webcal://…/ics/stagione/<stagione>`): orari e risultati si aggiornano da soli.
- **Feedback**: il link con il fumetto in alto (e in fondo alle pagine) apre `/feedback`, dove
  chiunque può lasciare un'idea o segnalare un problema; i messaggi si leggono solo in
  *Admin → Feedback* (protezione con la RLS).

**Dare l'accesso alla squadra**
1. Supabase → *Authentication → Users → Add user*: email e password (un account per persona,
   oppure uno solo condiviso da tutta la squadra).
2. *Admin → Area squadra → Accessi*: scrivi l'email e scegli **Squadra**.

**Date di nascita, paste, allenamenti e pause**: data di nascita e giorno delle paste nella scheda
del giocatore (*Admin → Giocatori*) o dello staff (*Admin → Staff*), anche solo giorno e mese; giorni e periodo degli allenamenti e pause (Natale,
Pasqua…) in *Admin → Area squadra*. Senza impostazioni valgono lunedì e giovedì da settembre a
maggio.

## PWA

- Manifest dinamico in `src/app/manifest.ts` (nome, colori, `display: standalone`), icone in
  `public/icons/` e `src/app/apple-icon.png`, `theme-color` e `viewport-fit=cover` in
  `src/app/layout.tsx`, metadata `appleWebApp`.
- Su iPhone: Safari → Condividi → **Aggiungi alla schermata Home**.
- Le icone usano il logo ufficiale su fondo nero; per cambiarle sostituisci i PNG mantenendo
  nomi e dimensioni (192, 512, maskable 512, apple 180).

## Design

Lo stile riprende le grafiche Instagram (@bolo.sgreeners): fondo nero, sfumature luminose
verde → giallo → arancio con grana, numeri condensati enormi, corsivo serif per gli accenti
("Final Score", "Next Game"), oro per le finali. Tutto è in `src/app/globals.css`: colori
(`--sg-primary` verde, `--sg-secondary` giallo, `--sg-accent` ambra, `--sg-gold`, `--sg-sky`),
sfumatura (`--sg-glow`), grana e classi `.glow-panel`, `.accent-serif`, `.eyebrow`,
`.text-gradient`. Font (in `src/app/layout.tsx`): Bebas Neue per titoli e numeri, Playfair
Display corsivo per gli accenti, Barlow per il testo.

**Tema chiaro**: il pulsante sole/luna nell'intestazione passa a un tema bianco con azzurro e
arancione (`:root[data-theme="light"]` in `globals.css`); la scelta resta salvata nel browser e
uno script nel `<head>` la applica prima del primo disegno (`src/lib/theme.ts`). I pannelli
"glow", in stile post Instagram, restano scuri anche nel tema chiaro.

Il logo ufficiale (dal Livescore CSI) è in `public/brand/` ed è usato per intestazione, squadra
e icone dell'app (`public/icons/`, `src/app/apple-icon.png`, `src/app/favicon.ico`).
