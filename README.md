# Bolo Sgreeners

Web app e archivio digitale dei **Bolo Sgreeners**, squadra di basket CSI di Bologna: stagioni,
roster, giocatori, partite con box score, calendari, classifiche, statistiche e storico.
Responsive, installabile come PWA, dati su Supabase.

- Report sulle fonti analizzate: [`docs/DATI_IDENTIFICATI.md`](docs/DATI_IDENTIFICATI.md)
- Architettura, schema e scelte tecniche: [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md)

## Cosa fa

- **Sito pubblico**: home con stagione in evidenza, ultima/prossima partita e leader; archivio
  stagioni; per ogni stagione panoramica, calendario (per giornata o per data), classifica,
  squadra (roster a figurine e staff) e statistiche (leader con soglie minime, totali e medie,
  filtro per fase), più le statistiche **All time** di tutte le stagioni (`/statistiche`); pagina
  giocatore (carriera, stagioni, fasi, record personali, partita per partita, altezza e mano);
  pagina partita (punteggio, parziali, palestra, leader, MVP, box score, confronto squadre, fonti,
  grafiche da scaricare); area squadra riservata (compleanni e paste); **feedback** (`/feedback`:
  idee e segnalazioni che legge solo l'admin).
- **Area admin** (`/admin`): import dei box score HTML con anteprima, associazione giocatori via
  alias e conferma; CRUD di stagioni, competizioni, regole di classifica, penalizzazioni,
  squadre, giocatori (con foto), roster per stagione, alias, partite; correzione delle statistiche
  importate (tracciata); gestione delle discrepanze tra fonti; audit degli import; **grafiche**
  per Instagram (`/admin/grafiche`); lettura dei **feedback** (`/admin/feedback`).
- **Import storico**: script che carica Excel, box score HTML e dati CSI curati, registrando la
  fonte di ogni dato e le discrepanze.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (PostgreSQL, Auth, Storage) · zod · node-html-parser · vitest · Vercel.

## Struttura

```
src/app/(site)/          pagine pubbliche
src/app/admin/           area admin (login + pagine protette)
src/components/          componenti UI (match, player, stats, standings, navigation, admin/…)
src/lib/importers/       parser box score: estrazione, normalizzazione, mapping, validazione, payload
src/lib/data/            letture dal database (con cache)
src/lib/domain/          logica pura: statistiche/leaderboard, classifica, formattazione
src/lib/admin/           autenticazione admin e server action
src/lib/supabase/        client Supabase e tipi generati (database.types.ts)
supabase/migrations/     migrations SQL versionate
supabase/demo/           dati demo (seed + eliminazione)
scripts/import-historical/  import storico (Excel + HTML + CSI curato)
scripts/local-db/        stack locale di test senza Docker (Postgres + PostgREST)
data/curated/            dati curati a mano (trascrizioni CSI) — committati
data/sources/            fonti originali (NON committate)
docs/                    report fonti e architettura
tests/                   test vitest con fixture sintetiche
```

## Configurazione locale

Requisiti: Node.js ≥ 20.9.

```bash
npm install
cp .env.example .env.local   # e compila le variabili
npm run dev                  # http://localhost:3000
```

### Variabili d'ambiente

| Variabile | Dove | Descrizione |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app + script | URL del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | chiave pubblica (*anon* o *publishable*); sicura nel browser grazie alla RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo script locali** | chiave *service role* / *secret*: mai su Vercel, mai nel repository |
| `NEXT_PUBLIC_SITE_URL` | app | URL pubblico del sito (metadata, OpenGraph, sitemap) |
| `REVALIDATE_SECRET` | app (Vercel) + GitHub | segreto per `POST /api/revalidate`, con cui l'aggiornamento automatico dal Livescore rigenera subito le pagine |

Senza Supabase configurato l'app parte comunque e mostra stati vuoti.

## Creare il progetto Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) e copia URL e chiavi
   (*Project Settings → API*) in `.env.local`.
2. Applica le migrations **da GitHub** (consigliato): nel repository, *Settings → Secrets and
   variables → Actions*, aggiungi `SUPABASE_ACCESS_TOKEN` (token da
   *supabase.com/dashboard/account/tokens*), `SUPABASE_PROJECT_ID` (Reference ID) e
   `SUPABASE_DB_PASSWORD`; poi *Actions → Database Supabase → Run workflow*. Il workflow
   (`.github/workflows/supabase-migrations.yml`) riparte da solo a ogni push su `main` che
   modifica `supabase/migrations/`.

   In alternativa, dalla CLI (inclusa nelle dev-dependency):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-progetto>
   npx supabase db push          # applica supabase/migrations/*
   npm run db:types              # rigenera src/lib/supabase/database.types.ts
   ```
   Le migrations creano tabelle, view, RLS, la funzione di import e i bucket Storage
   (`match-files` privato, `media` pubblico). **Nessuna modifica manuale al database senza una
   nuova migration** (`npx supabase migration new <nome>`).
3. *Authentication → Providers → Email*: disattiva **Allow new users to sign up** (gli admin si
   creano a mano).
4. **Creare un amministratore**: *Authentication → Users → Add user* (email + password), poi
   nello SQL Editor:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'tua@email.it';
   ```

## Caricare i dati

### Import storico (una tantum)

1. Copia il contenuto del pacchetto fonti in `data/sources/` (cartelle `01_EXCEL`,
   `02_HTML_PARTITE`, …). La cartella è in `.gitignore`.
2. Prova senza scrivere nulla:
   ```bash
   npm run import:historical -- --dry-run
   ```
   Stampa il riepilogo e scrive il dataset intermedio in `data/build/`.
3. Importa (usa `SUPABASE_SERVICE_ROLE_KEY` da `.env.local`):
   ```bash
   npm run import:historical            # carica anche gli HTML su Storage
   npm run import:historical -- --no-storage
   ```
   Rieseguirlo è sicuro: niente duplicati, e le righe già presenti (magari corrette dall'admin)
   non vengono sovrascritte se non con `--update`.
4. In `/admin` premi **Aggiorna il sito pubblico**: le pagine mostrano subito i dati nuovi
   (altrimenti si aggiornano entro un'ora; un nuovo deploy non basta, perché Vercel riusa la cache
   dei dati).

### Aggiornare dal Livescore CSI

Calendario, risultati, parziali, palestre e classifiche ufficiali arrivano dal Livescore CSI
Bologna.

**In automatico (stagione in corso).** Il workflow `.github/workflows/livescore.yml` lancia
`npm run livescore:update` ogni mattina e ogni notte dopo le partite: scarica dal Livescore solo la
stagione in corso e aggiorna direttamente sul database orari, palestre, risultati, parziali e
classifica (senza bisogno delle fonti storiche), poi rigenera le pagine del sito. Il riepilogo di
ogni esecuzione è in *GitHub → Actions → Livescore CSI*; da lì si può anche lanciare a mano (con
"prova" mostra le modifiche senza scrivere). Per attivarlo:

1. GitHub → *Settings → Secrets and variables → Actions*: aggiungi `SUPABASE_URL` (lo stesso di
   `NEXT_PUBLIC_SUPABASE_URL`) e `SUPABASE_SERVICE_ROLE_KEY`; per l'aggiornamento immediato delle
   pagine anche `SITE_URL` (es. `https://bolo-sgreeners.vercel.app`) e `REVALIDATE_SECRET` (una
   stringa lunga a caso).
2. Vercel → *Settings → Environment Variables*: aggiungi `REVALIDATE_SECRET` con lo stesso valore
   e rifai il deploy.

Dal computer: `npm run livescore:update -- --dry-run` mostra cosa cambierebbe, senza `--dry-run`
scrive. Una squadra mai vista viene creata e segnalata: aggiungila a `data/curated/teams.json`
con lo stesso slug. GitHub sospende i workflow programmati dopo 60 giorni senza attività nel
repository: se succede, riattivalo dalla pagina Actions.

**A mano (tutte le stagioni, con le fonti storiche).** Per rigenerare anche `livescore.json` e
ricostruire tutto con l'import storico:

```bash
npm run livescore:sync                       # scarica e riscrive data/curated/livescore.json
npm run import:historical -- --update        # porta le novità nel database
```

Le stagioni e le competizioni da seguire sono in `data/curated/competitions.json` (`csiTeamId` e
`csi_project_id`, presi dagli URL del Livescore). Se lo script segnala una squadra o una
competizione non configurata, aggiungila lì; se un avversario nuovo non è riconosciuto, aggiungilo
a `data/curated/teams.json` con il nome ufficiale CSI. Le formazioni del Livescore non vengono
importate: le statistiche dei giocatori arrivano solo dai box score.

Con `--update` lo script corregge anche le righe già presenti (avversari, casa/trasferta, orari)
e chiude con una nota le discrepanze risolte dal CSI; i punteggi presi dai box score non vengono
cancellati. Le correzioni fatte a mano dall'admin su partite e giocatori invece vengono
sovrascritte: in quel caso conviene correggere i file in `data/curated/`.

### Nuove partite

Da `/admin/import`: scegli la stagione, carica l'HTML di Easy Stats, controlla l'anteprima,
associa la partita (suggerita per data e avversario) e i giocatori, conferma.

### Dati demo

Solo per provare le schermate su un database vuoto (stagione `1999-00`, slug `demo-…`):

```bash
psql "$DATABASE_URL" -f supabase/demo/seed-demo.sql    # oppure dallo SQL Editor
psql "$DATABASE_URL" -f supabase/demo/delete-demo.sql  # li elimina tutti
```

Non usarli insieme ai dati reali.

## Squadra, staff e area riservata

- **Squadra** (`/stagioni/<stagione>/squadra`): roster a figurine (numero, ruolo, badge capitano,
  vice capitano, nuovo arrivo, staff) e scheda **Staff**. Ruoli, capitano e vice si impostano in
  *Admin → Giocatori e roster*; lo staff in *Admin → Staff* (oppure in `data/curated/staff.json`,
  caricato dall'import storico). L'**MVP** di una partita si sceglie in *Admin → Partite*.
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

- **Grafiche per Instagram** (stile della stagione 2026-27: fondo nero con grana, scie al neon,
  riquadri verdi in casa e arancioni in trasferta), in formato post (1080×1350) o storia
  (1080×1920). Modelli: *Game day* (presentazione della partita), *Chiamata ai tifosi*, *Final
  Score*, *Tabellino* (migliori, percentuali e marcatori dal box score importato), *MVP* e
  *Calendario del mese*. Da *Admin → Grafiche* si sceglie partita e modello, si può caricare una
  foto di sfondo e cambiare il titolo, con anteprima e download; i pulsanti principali sono anche
  nella pagina della partita, visibili solo all'admin (le route `/grafiche` rispondono 401 a chi
  non è admin). I loghi degli avversari arrivano dal Livescore con
  `npm run livescore:logos` (o si caricano a mano in *Admin → Squadre*; senza logo, le iniziali) e
  compaiono anche in classifica, calendario e pagina partita. Generate da `src/app/grafiche/` (`src/lib/graphics/`) con i font in `assets/fonts`
  (licenza OFL).
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

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` / `build` / `start` | sviluppo, build di produzione, avvio |
| `npm run check` | typecheck + lint + test |
| `npm run test` | test vitest (parser, alias, classifica, leaderboard) |
| `npm run check:html -- <cartella>` | analizza tutti gli HTML di una cartella e mostra problemi/duplicati |
| `npm run livescore:sync` | scarica dal Livescore CSI calendario, risultati e classifiche |
| `npm run livescore:update` | aggiorna sul database la stagione in corso dal Livescore (usato dal workflow automatico) |
| `npm run livescore:logos` | carica i loghi delle squadre dal Livescore (`--dry-run` per vedere, `--update` per sostituirli) |
| `npm run import:historical` | import storico (vedi sopra) |
| `npm run db:types` | rigenera i tipi TypeScript dal database collegato |
| `npm run db:local:reset` / `db:local:stack` | stack di test locale senza Docker (vedi sotto) |

## Deploy su Vercel

1. Importa il repository su Vercel (framework: Next.js, nessuna configurazione speciale).
2. Variabili d'ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL` (es. `https://bolo-sgreeners.vercel.app`), `REVALIDATE_SECRET` (vedi
   *Aggiornare dal Livescore CSI*). **Non** aggiungere la service role key.
3. Deploy. Durante la build vengono prerenderizzate le pagine di stagioni, giocatori e partite
   leggendo il database; le nuove pagine si generano alla prima visita.

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

## Sistema di import

Pipeline in `src/lib/importers/`, separata dal database:

1. **Estrazione** — `easystats/extract.ts`: HTML → `RawBoxScore` (squadre, colonne, righe,
   parziali, shot chart con ID interni).
2. **Normalizzazione** — `easystats/normalize.ts` + `normalize.ts`: nomi, numeri di maglia ("0"
   ≠ "00"), realizzati/tentati, date italiane/inglesi, giocatori assenti/non entrati, squadra nostra
   riconosciuta dagli alias (nessun nome cablato).
3. **Mapping** — `mapping.ts`: nomi → giocatori tramite `player_aliases` (con limiti per stagione
   e numero); ambiguità e nomi nuovi richiedono una scelta; nessun giocatore creato da solo.
4. **Validazione** — `validate.ts`: punti vs tiri, somma giocatori vs totale, parziali,
   risultato ufficiale, data.
5. **Persistenza** — `payload.ts` + funzione SQL `import_match_report`: transazione unica,
   idempotente (hash del file), conflitti registrati, file originale su Storage con parser e
   versione.

**Aggiungere o aggiornare un parser**: crea `src/lib/importers/<formato>/extract.ts` e
`normalize.ts` sul modello di `easystats/`, registralo in `PARSERS` (`src/lib/importers/index.ts`)
e incrementa la versione quando cambia l'output. Aggiungi una fixture *sintetica* in
`tests/fixtures/` e i test relativi (i file reali restano fuori dal repository).

## Ruolo delle fonti

| Fonte | Ruolo | Dove entra |
| --- | --- | --- |
| HTML Easy Stats | fonte primaria delle statistiche partita (giocatori e squadre), parziali | import admin / script |
| Excel storici | roster, alias, partite senza HTML (PDF/foto/articoli trascritti); per le gare con HTML solo verifica | script storico |
| CSI / Livescore | risultati ufficiali, calendario, orari, palestre, parziali, classifiche | `npm run livescore:sync` → `data/curated/livescore.json`, oppure admin |
| Instagram | identità visiva, foto, informazioni qualitative (mai numeri) | design / admin (foto) |

Una fonte secondaria non sovrascrive mai la primaria: le differenze diventano righe in
`source_conflicts`, visibili in `/admin/discrepanze`.

## Test locale senza Docker

Per sviluppare senza un progetto Supabase si può usare uno stack minimale (Postgres 16 +
PostgREST + un proxy che imita Auth e Storage per un solo utente admin):

```bash
PGHOST=/tmp PGPORT=54329 npm run db:local:reset     # crea il DB "bolo" e applica le migrations
postgrest postgrest.conf &                           # db-uri verso "bolo", jwt-secret come in dev-stack.mjs
npm run db:local:stack                               # proxy su http://127.0.0.1:54321
node scripts/local-db/dev-stack.mjs keys             # stampa ANON_KEY e SERVICE_ROLE_KEY per .env.local
```

È solo uno strumento di test (vedi i commenti nei file in `scripts/local-db/`).
