# Note di lavoro — Bolo Sgreeners

Quello che serve sapere per continuare il progetto e che non si capisce leggendo il codice.
Il README spiega l'architettura; qui ci sono abitudini, decisioni prese e lavori in corso.

## Come lavoriamo

- Si parla in **italiano**. Ogni modifica va su un ramo, poi PR su GitHub (`AleandroAlushi/bolo-sgreeners`), poi controllo di Vercel, poi **squash merge**. Il merge si fa solo con l'ok dell'utente.
- Sito: https://bolo-sgreeners.vercel.app. Database: Supabase (piano gratuito).
- Le migration in `supabase/migrations/` partono da sole al merge (GitHub Action "Database Supabase").
- Dopo un merge con migration, controllare che il deploy di Vercel sia riuscito.
  - Se il database è occupato, la build può andare in timeout. Si aspetta qualche minuto e si rifà il deploy con un commit vuoto.
- **Segreti:** la chiave service role di Supabase sta solo in `.env.local` e nei secrets di GitHub, mai su Vercel e mai in chat.
- Le **date di nascita** sono private e stanno in `data/private/`, che non va su GitHub.
- Account veri e login sul sito di produzione non si creano. Per provare l'area admin si usa il database di prova in locale (vedi sotto).
- Le pagine del sito si aggiornano entro un'ora dopo una modifica fatta direttamente al database. Per vederle subito, si salva un giocatore qualsiasi in *Admin*.

## Database di prova in locale (senza Docker)

Serve per provare l'area admin, la diretta e le grafiche senza toccare la produzione. Si usano Postgres 17 di Homebrew, PostgREST e il proxy `scripts/local-db/dev-stack.mjs`. La configurazione di PostgREST è in `scripts/local-db/postgrest.conf`.

```bash
initdb -D <cartella> -U postgres -A trust          # solo la prima volta
pg_ctl -D <cartella> -o "-p 54329 -k /tmp -c listen_addresses=''" -l <log> -w start
PGHOST=/tmp PGPORT=54329 scripts/local-db/reset.sh # crea il DB "bolo" con tutte le migration
postgrest scripts/local-db/postgrest.conf &
node scripts/local-db/dev-stack.mjs &              # proxy su http://127.0.0.1:54321
node scripts/local-db/dev-stack.mjs keys 00000000-0000-4000-8000-000000000001   # chiavi locali
```

- **Dati storici:** `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<chiave locale> npx tsx scripts/import-historical/index.ts --sources=data/sources/Bolo_Sgreeners_Fonti_Claude --no-storage`.
- **Admin di prova:**
  - inserire l'utente `00000000-0000-4000-8000-000000000001` in `auth.users` e in `user_roles` con ruolo `admin`;
  - login con `admin@sgreeners.local` / `sgreeners`.
- **Sito in locale:** creare `.env.development.local` con l'URL locale e la chiave anon locale, poi `npm run dev`. Alla fine cancellare `.env.development.local`.

## Caricature dei giocatori (stagione 2026-27)

Al posto delle foto, ogni giocatore ha una caricatura in stile figurina del Fantacalcio. Il disegno lo fa **Gemini**, perché Claude non genera immagini. Noi lo scontorniamo e lo mettiamo sullo sfondo Sgreeners.

**Fatti** (foto 2026-27 già sul sito; card e disegni originali in `data/private/caricature/`):
- **Federico Hrvatin "Chicco" (#32):** la piovra, con tentacoli viola al posto delle braccia e una tastiera (studia ingegneria informatica). Fatto ancora su sfondo blu: andrebbe rifatto su **verde #00FF00**, per via dei tentacoli viola.
- **Luca Biolchini (#15):** studente di medicina e runner. Corre con il camice che svolazza e lo stetoscopio.
- **Gianmarco Tomba "Giamma" (#18), non "Gemma":** in bici da corsa, con fischietto e lavagnetta tattica, perché allena le giovanili. Nel portaborraccia ha un pallone da basket.
- **Filippo Bertuzzi "il Bertuz" (#13):** versione "Brr Brr Patapim", con corpo d'albero e muschio, zaino da rider turchese tipo Deliveroo, ciondolo con la stella di David e il suo goldendoodle.

- **Matteo Mazzanti "Teo" (#1):** in versione gatto, con orecchie, baffi, coda e zampe nere, in abito nero con risvolti verdi. Salta e prende il topo come un rimbalzo, appena uscito da un canestro. Il canestro tocca i bordi del disegno, quindi la card è fatta con `--ancora`.
- **Andrea Maccaferri "Macca" (#11):** "il cavallo" perché corre tantissimo. È un centauro con le dita a pistola alle tempie, la sua posa tipica. La canotta l'ha disegnata Gemini con il logo del ponte, dopo qualche tentativo.
- **Marcello Lagna "il gorilla" (#3):** esulta battendosi il petto, per questo è "il gorilla". È disegnato con un costume da gorilla stile mascotte e il suo viso umano scoperto: niente viso da scimmia, e si è evitato qualsiasi richiamo al colore della pelle. Lo affiancano una grigliata argentina (asado) e la bandiera dell'Argentina, dove è stato. Il baffetto l'abbiamo tolto: nella foto c'era per caso.

**In corso:**
- **Francesco Carini (#2):** ex calciatore e tifoso del Bologna. Prompt già preparato: palleggia con un pallone da calcio, sciarpa e calzettoni rossoblù, niente stemmi. Si aspetta il disegno.
- **Gli altri della rosa:** l'utente manda, uno alla volta, il soprannome e il dettaglio comico; noi prepariamo il prompt.
- **Gemini:** l'utente ha il piano Plus, con limiti stretti. Si resta sempre nella stessa chat di Gemini: lì ha già le caricature fatte, quindi basta scrivere "stesso stile, stessa divisa e stesso sfondo magenta delle caricature che hai già fatto in questa chat", senza riallegarle. Per correggere un dettaglio, per esempio la canotta, si dice esattamente cosa togliere e cosa tenere ("modifica SOLO la canotta…").

**Procedimento:**
1. **Prompt per Gemini.**
   - Si allegano 2-3 foto vere del giocatore e, come riferimento di stile, una caricatura già fatta, per esempio Giamma.
   - Le foto vere stanno nelle stagioni 2023-24 e 2024-25 della pagina Squadra; quelle dello staff nella pagina Staff. Le figurine 2025-26 erano meme (una battuta interna) e sono state tolte.
   - Struttura del prompt:
     - le foto e la descrizione fisica;
     - "stesso stile dell'immagine di riferimento": contorni neri marcati, colori pieni, testa grande, figura intera, formato 4:5;
     - il dettaglio comico;
     - la divisa: canotta nera con numero arancione e bordi verde neon, pantaloncini neri o azzurri con bande arancio e verde, scarpe verde neon.
   - **Sfondo magenta pieno #FF00FF**, uniforme, senza ombra a terra e senza contorno bianco. Se il personaggio ha rosa o viola, sfondo **verde pieno #00FF00**.
   - Niente scritte, loghi, stemmi o cornici. Per lo scontorno conviene chiedere esplicitamente "niente rosa, viola o magenta nel personaggio".
2. **Card:**
   ```bash
   node scripts/caricature/card.cjs <disegno> data/private/caricature/card/<slug>.jpg [--chiave verde] [--ombra]
   ```
   `--ombra` aggiunge un'ombra a terra, da usare se Gemini non l'ha disegnata. `--migliora` serve per i disegni piccoli o sgranati: li ingrandisce 2x e toglie la grana. `--ancora` serve quando il disegno tocca il bordo sinistro e quello in basso, per esempio un canestro tagliato: lo appoggia a filo dei bordi della card invece di centrarlo. Il colore esatto dello sfondo lo misura dai bordi, perché Gemini non dà sempre un magenta puro. Lo script crea anche `<slug>-figurina.jpg` a 900×1125.
3. **Sul sito:**
   ```bash
   npx tsx --env-file-if-exists=.env.local scripts/caricature/carica.ts <slug> data/private/caricature/card/<slug>-figurina.jpg 2026-27
   ```

## Grafiche Instagram

- Si fanno da *Admin → Grafiche*:
  - presentazione della partita (post e storia), con le sigle delle squadre ("BSG VS POR", "AT" in trasferta);
  - carosello del dopo partita: finale, MVP, box score, leader;
  - didascalie scritte dai numeri.
- **Dati da compilare:** sigle e loghi degli avversari in *Admin → Squadre*; profili Instagram dei giocatori nei loro dati riservati.
- **Scontorni per MVP e leader:** nella stessa pagina, sezione "Scontorni dei giocatori". Li fa il browser con MediaPipe.

## Video promo della web app

Il video dura 60 secondi, verticale. Mostra home, notifiche, prossima partita con le indicazioni, diretta, box score ordinabile, statistiche e leader, classifica, figurine. I file finiti sono in `data/private/video/`:
- `reel-60s.mp4`: per i Reel e le storie;
- `post-video-4x5.mp4` e `post-copertina.jpg`: post a due slide, con la copertina "Nuova app";
- `reel-60s-alta-qualita.mp4`: piena qualità.

Le registrazioni da cui rifarlo sono in `data/private/video/lavoro/` (`rec`, `rec-live`).

**Per rifarlo** (Chrome installato; script in `scripts/video/`):
1. `node scripts/video/record.cjs`
   - Registra il giro sul sito vero, come da telefono.
   - Le notifiche sono simulate: nessuna iscrizione finisce nel database.
2. Diretta di prova, **solo sul database locale**:
   - `node scripts/video/gen-live.cjs 11`, poi `psql -f data/private/video/lavoro/live.sql` sul DB locale;
   - con il sito locale acceso: `SITE=http://localhost:3000 OUTDIR=rec-live node scripts/video/record-live.cjs`.
3. `NODE_OPTIONS=--conditions=react-server npx tsx scripts/video/overlays.tsx`
   - Crea le scritte, l'apertura e la chiusura.
4. `node scripts/video/compose.cjs`
   - Monta i fotogrammi: taglia i caricamenti e porta il video a 60 secondi.
   - Per cambiare tagli o durata si modificano `segs` e `TARGET`.
5. Esportazione MP4, senza ffmpeg:
   - `swiftc -O scripts/video/encode.swift -o data/private/video/lavoro/encode`
   - `data/private/video/lavoro/encode data/private/video/lavoro/out <uscita.mp4> 30 3200000`
   - L'ultimo numero è il bitrate: con 3,2 Mbit/s il file da 60 secondi resta sotto i 30 MB.
6. Formato post 4:5:
   - `npx tsx scripts/video/post-bg.tsx`, sempre con `NODE_OPTIONS=--conditions=react-server`;
   - `node scripts/video/compose45.cjs` e poi `encode` su `out45`.

La musica si aggiunge su Instagram, dalla sua libreria, così non ci sono problemi di diritti.

## Altre cose decise

- **Staff:** in tutte le stagioni Pietro Venturi è dirigente accompagnatore e Aleandro Alushi fa le statistiche.
- **Federico Rossi:** la mano "mistero" è una gag voluta.
- **Statistiche:** ordine delle colonne MIN · PTS · TIRI · TIRI% · 3P · 3P% · TL · TL% · RO · RD · AST · REC · STP · PP · F · +/-. Le tabelle si ordinano toccando l'intestazione.
- **Suono all'apertura dell'app:** provato e tolto, l'utente non lo vuole.
- **Livescore:** il controllo rapido della sera lo lancia cron-job.org (job "Livescore Sgreeners"); serve solo il nostro girone.
