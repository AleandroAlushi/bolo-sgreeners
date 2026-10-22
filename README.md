# Bolo Sgreeners

Web app e archivio digitale dei **Bolo Sgreeners**, squadra di basket CSI di Bologna: stagioni,
roster, giocatori, partite con box score, calendari, classifiche, statistiche e storico.
Responsive, installabile come PWA, dati su Supabase.

- Report sulle fonti analizzate: [`docs/DATI_IDENTIFICATI.md`](docs/DATI_IDENTIFICATI.md)
- Architettura, schema e scelte tecniche: [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md)

## Cosa fa

- **Sito pubblico**: home con stagione in evidenza, ultima/prossima partita e leader; archivio
  stagioni; per ogni stagione panoramica, calendario (per giornata o per data), classifica,
  roster e statistiche (leader con soglie minime, totali e medie, filtro per fase); pagina
  giocatore (carriera, stagioni, fasi, record personali, partita per partita); pagina partita
  (punteggio, parziali, palestra, leader, box score, confronto squadre, fonti).
- **Area admin** (`/admin`): import dei box score HTML con anteprima, associazione giocatori via
  alias e conferma; CRUD di stagioni, competizioni, regole di classifica, penalizzazioni,
  squadre, giocatori (con foto), roster per stagione, alias, partite; correzione delle statistiche
  importate (tracciata); gestione delle discrepanze tra fonti; audit degli import.
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
   non vengono sovrascritte se non con `--update`. Le pagine pubbliche si aggiornano entro un'ora
   (o al deploy successivo).

### Aggiornare dal Livescore CSI

Calendario, risultati, parziali, palestre e classifiche ufficiali arrivano dal Livescore CSI
Bologna. Per aggiornarli (per esempio ogni settimana durante la stagione):

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

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` / `build` / `start` | sviluppo, build di produzione, avvio |
| `npm run check` | typecheck + lint + test |
| `npm run test` | test vitest (parser, alias, classifica, leaderboard) |
| `npm run check:html -- <cartella>` | analizza tutti gli HTML di una cartella e mostra problemi/duplicati |
| `npm run livescore:sync` | scarica dal Livescore CSI calendario, risultati e classifiche |
| `npm run import:historical` | import storico (vedi sopra) |
| `npm run db:types` | rigenera i tipi TypeScript dal database collegato |
| `npm run db:local:reset` / `db:local:stack` | stack di test locale senza Docker (vedi sotto) |

## Deploy su Vercel

1. Importa il repository su Vercel (framework: Next.js, nessuna configurazione speciale).
2. Variabili d'ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL` (es. `https://bolo-sgreeners.vercel.app`). **Non** aggiungere la service
   role key.
3. Deploy. Durante la build vengono prerenderizzate le pagine di stagioni, giocatori e partite
   leggendo il database; le nuove pagine si generano alla prima visita.

## PWA

- Manifest dinamico in `src/app/manifest.ts` (nome, colori, `display: standalone`), icone in
  `public/icons/` e `src/app/apple-icon.png`, `theme-color` e `viewport-fit=cover` in
  `src/app/layout.tsx`, metadata `appleWebApp`.
- Su iPhone: Safari → Condividi → **Aggiungi alla schermata Home**.
- Le icone sono **provvisorie** (monogramma "BS"): sostituisci i PNG mantenendo nomi e
  dimensioni (192, 512, maskable 512, apple 180).

## Design

Palette e font in `src/app/globals.css` (`--sg-primary`, `--sg-secondary`, `--sg-accent`,
`--sg-bg`, `--sg-win`, `--sg-loss`…). I colori attuali sono ricavati dal logo visibile sul
Livescore CSI (linee neon su nero): **provvisori**, da confermare con l'identità Instagram.

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
