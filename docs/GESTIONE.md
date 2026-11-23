# Gestione tecnica

Come si configura e si mantiene il sito: database, deploy, import dei dati e
aggiornamenti automatici. Per sviluppare in locale vedi [CONTRIBUTING.md](../CONTRIBUTING.md).

## Variabili d'ambiente

| Variabile | Dove | Descrizione |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app + script | URL del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | chiave pubblica (*anon* o *publishable*); sicura nel browser grazie alla RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo script locali** | chiave *service role* / *secret*: mai su Vercel, mai nel repository |
| `NEXT_PUBLIC_SITE_URL` | app | URL pubblico del sito (metadata, OpenGraph, sitemap) |
| `REVALIDATE_SECRET` | app (Vercel) + GitHub | segreto per `POST /api/revalidate`, con cui l'aggiornamento automatico dal Livescore rigenera subito le pagine |

Senza Supabase configurato l'app parte comunque e mostra stati vuoti.

## Tutti i comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` / `build` / `start` | sviluppo, build di produzione, avvio |
| `npm run check` | typecheck + lint + test |
| `npm run test` | test vitest (parser, alias, classifica, leaderboard) |
| `npm run check:html -- <cartella>` | analizza tutti gli HTML di una cartella e mostra problemi/duplicati |
| `npm run livescore:sync` | scarica dal Livescore CSI calendario, risultati e classifiche |
| `npm run livescore:update` | aggiorna sul database la stagione in corso dal Livescore (usato dal workflow automatico) |
| `npm run photos:import` | carica le foto di una stagione da una cartella (vedi *Foto per stagione*) |
| `npm run livescore:logos` | carica i loghi delle squadre dal Livescore (`--dry-run` per vedere, `--update` per sostituirli) |
| `npm run import:historical` | import storico (vedi sopra) |
| `npm run db:types` | rigenera i tipi TypeScript dal database collegato |
| `npm run photos:reframe` / `photos:avatar` | ritocca l'inquadratura delle figurine / ricalcola il viso nel tondino |
| `npm run notify` | invia le notifiche push dovute (lo lancia il workflow del Livescore) |
| `npm run db:local:reset` / `db:local:stack` | database di prova in locale (vedi [CONTRIBUTING.md](../CONTRIBUTING.md)) |

## Creare il progetto Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) e copia URL e chiavi
   (*Project Settings → API*) in `.env.local`.
2. Applica le migrations **da GitHub** (consigliato): nel repository, *Settings → Secrets and
   variables → Actions*, aggiungi **`SUPABASE_DB_URL`**: la stringa di connessione del database
   (Supabase → *Connect* → *Session pooler* → URI, con la password al posto di
   `[YOUR-PASSWORD]`). Non scade e non serve nessun token. In alternativa vanno ancora bene
   `SUPABASE_ACCESS_TOKEN` (token da *supabase.com/dashboard/account/tokens*, permessi Project
   read e Database write; scade), `SUPABASE_PROJECT_ID` (Reference ID) e `SUPABASE_DB_PASSWORD`.
   Poi *Actions → Database Supabase → Run workflow*. Il workflow
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

## Deploy su Vercel

1. Importa il repository su Vercel (framework: Next.js, nessuna configurazione speciale).
2. Variabili d'ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL` (es. `https://bolo-sgreeners.vercel.app`), `REVALIDATE_SECRET` (vedi
   *Aggiornare dal Livescore CSI*). **Non** aggiungere la service role key.
3. Deploy. Durante la build vengono prerenderizzate le pagine di stagioni, giocatori e partite
   leggendo il database; le nuove pagine si generano alla prima visita.

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
stagione in corso e aggiorna direttamente sul database orari, palestre, risultati, parziali,
classifica e giornate del nostro girone (anche le partite tra le altre squadre), senza bisogno
delle fonti storiche, poi rigenera le pagine del sito. La sera, dalle 20 all'una, cron-job.org lo
lancia anche ogni 15 minuti con `--rapido` (vedi sotto): legge solo la pagina risultati del girone e
fa l'aggiornamento completo solo se c'è una novità; il sito si rigenera solo quando cambia qualcosa. Il riepilogo di
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

**Controllo serale con cron-job.org (attivo).** Il cron di GitHub parte spesso in ritardo (anche
di ore), quindi il controllo ogni 15 minuti lo fa partire [cron-job.org](https://cron-job.org)
(gratuito, job "Livescore Sgreeners"). Il token scade il 28 luglio 2027: va rigenerato e aggiornato
su cron-job.org. Per rifarlo da zero:

1. GitHub → *Settings → Developer settings → Fine-grained tokens → Generate new token*: solo il
   repository `bolo-sgreeners`, permesso *Actions: Read and write*, scadenza a fine stagione.
2. cron-job.org → nuovo cron job: URL
   `https://api.github.com/repos/AleandroAlushi/bolo-sgreeners/actions/workflows/livescore.yml/dispatches`,
   metodo `POST`, ogni 15 minuti dalle 20 all'1 (fuso Europe/Rome), intestazioni
   `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`,
   `X-GitHub-Api-Version: 2022-11-28`, corpo `{"ref":"main","inputs":{"rapido":"true"}}`.
   GitHub risponde `204` quando parte.
3. Senza cron-job.org il controllo serale non parte: per tornare al cron di GitHub, aggiungi a
   `livescore.yml` la riga `- cron: "*/15 19-23 * * *"` e passa `--rapido` per quell'orario.

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
cancellati. Se nel database il Livescore è più recente di `livescore.json` (perché lo
aggiorna ogni giorno `livescore:update`), calendario, risultati, parziali e classifica di quelle
competizioni non vengono riportati indietro: si aggiungono solo le righe mancanti. Le correzioni fatte a mano dall'admin su partite e giocatori invece vengono
sovrascritte: in quel caso conviene correggere i file in `data/curated/`.

### Nuove partite

Di solito il box score nasce dalle **statistiche live** (vedi [FUNZIONALITA.md](FUNZIONALITA.md)).
Per un file di Easy Stats: *Admin → Archivio → Import* (`/admin/import`): scegli la stagione, carica l'HTML di Easy Stats, controlla l'anteprima,
associa la partita (suggerita per data e avversario) e i giocatori, conferma.

### Dati demo

Solo per provare le schermate su un database vuoto (stagione `1999-00`, slug `demo-…`):

```bash
psql "$DATABASE_URL" -f supabase/demo/seed-demo.sql    # oppure dallo SQL Editor
psql "$DATABASE_URL" -f supabase/demo/delete-demo.sql  # li elimina tutti
```

Non usarli insieme ai dati reali.

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
`source_conflicts`, visibili in *Admin → Archivio → Discrepanze* (`/admin/discrepanze`).
Gli alias (`player_aliases`, `team_aliases`) non si gestiscono più dall'admin: restano nel database
perché l'import li usa da solo per riconoscere i nomi nei file vecchi.
