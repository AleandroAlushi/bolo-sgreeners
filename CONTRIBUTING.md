# Come contribuire

Grazie per dare una mano! Il sito è usato davvero dalla squadra, quindi ogni modifica passa da una
pull request e da un controllo prima di andare online.

## Il flusso di lavoro

1. Parti da `main` aggiornato e crea un ramo con un nome che dica cosa fai:
   ```bash
   git checkout main && git pull
   git checkout -b fix/classifica-pareggi
   ```
2. Fai le modifiche e lancia i controlli:
   ```bash
   npm run check    # typecheck + lint + test
   ```
3. Fai push del ramo e apri una pull request verso `main`. Scrivi in italiano cosa cambia e come
   provarlo.
4. Vercel crea in automatico un **sito di prova** per la PR (il link compare nella PR).
   ⚠️ Il sito di prova legge i **dati veri** di produzione: non usarlo per fare prove che scrivono
   nel database.
5. `main` è protetto: serve **l'approvazione di Aleandro** prima del merge. Il merge è sempre
   *squash* (tutti i commit della PR diventano uno solo).

### Cosa succede al merge
- Vercel pubblica il sito.
- Se la PR contiene file in `supabase/migrations/`, la GitHub Action "Database Supabase" li applica
  **al database vero**. Per questo:
  - non modificare mai una migration già unita: crea sempre un file nuovo
    (`npx supabase migration new <nome>`);
  - prova le migration sul database locale (sotto) prima di aprire la PR;
  - nel sito di prova della PR le migration non ci sono ancora: partono solo al merge.

## Regole

- **Segreti:** non mettere mai chiavi, token o file `.env*` nei commit. La chiave *service role* di
  Supabase non serve per sviluppare: usa il database locale.
- **Dati personali:** date di nascita e foto originali stanno in `data/private/`, che non è su
  GitHub e non va aggiunta. Nei test usa solo dati inventati (`tests/fixtures/`).
- **Nessuna modifica manuale al database di produzione:** ogni cambio di schema è una migration.
- **Next.js 16** ha API diverse dalle versioni precedenti: in caso di dubbio guarda la guida in
  `node_modules/next/dist/docs/`.

## Database di prova in locale (senza Docker)

Serve per provare l'area admin, la diretta e le grafiche senza toccare la produzione. Usa
Postgres 17, [PostgREST](https://postgrest.org) e un piccolo proxy che imita Auth e Storage di
Supabase per un solo utente admin.

```bash
initdb -D <cartella> -U postgres -A trust          # solo la prima volta
pg_ctl -D <cartella> -o "-p 54329 -k /tmp -c listen_addresses=''" -l <log> -w start
PGHOST=/tmp PGPORT=54329 npm run db:local:reset    # crea il DB "bolo" con tutte le migration
postgrest scripts/local-db/postgrest.conf &
npm run db:local:stack &                           # proxy su http://127.0.0.1:54321
node scripts/local-db/dev-stack.mjs keys 00000000-0000-4000-8000-000000000001   # chiavi locali
```

- **Sito in locale:** crea `.env.development.local` con
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` e la chiave *anon* locale, poi `npm run dev`.
- **Utente admin di prova:** inserisci l'utente `00000000-0000-4000-8000-000000000001` in
  `auth.users` e in `user_roles` con ruolo `admin`, poi entra con `admin@sgreeners.local` /
  `sgreeners`.
- **Dati demo** per vedere le pagine piene: `PGHOST=/tmp PGPORT=54329 psql -U postgres -d bolo -f supabase/demo/seed-demo.sql` (stagione
  `1999-00`); `delete-demo.sql` li toglie.

I dettagli sono nei commenti dei file in `scripts/local-db/`.
