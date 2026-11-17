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
- **Federico Hrvatin "Chicco" (#32):** la piovra, con tentacoli viola al posto delle braccia e una tastiera (studia ingegneria informatica). Il disegno è su sfondo blu, ma la card è già con la sfumatura Sgreeners come le altre: non va rifatto.
- **Luca Biolchini (#15):** studente di medicina e runner. Corre con il camice che svolazza e lo stetoscopio. Nella seconda versione (viso rifatto con foto nuove) è la stella della squadra (stella dorata e bagliore), taglia il nastro del traguardo e ha Sid dell'Era glaciale aggrappato alla schiena: scelta dell'utente, sapendo che è un personaggio protetto. Dopo lo scontorno l'alone del bagliore viene rosa: ricolorato in arancio. Card vecchia: `luca-biolchini-v1.jpg`.
- **Gianmarco Tomba "Giamma" (#18), non "Gemma":** in bici da corsa, con fischietto e lavagnetta tattica, perché allena le giovanili. Nel portaborraccia ha un pallone da basket.
- **Filippo Bertuzzi "il Bertuz" (#13):** versione "Brr Brr Patapim", con corpo d'albero e muschio, zaino da rider turchese tipo Deliveroo, ciondolo con la stella di David e il suo goldendoodle.

- **Matteo Mazzanti "Teo" (#1):** in versione gatto, con orecchie, baffi, coda e zampe nere, in abito nero con risvolti verdi. Salta e prende il topo come un rimbalzo, appena uscito da un canestro. Il canestro tocca i bordi del disegno, quindi la card è fatta con `--ancora`.
- **Andrea Maccaferri "Macca" (#11):** "il cavallo" perché corre tantissimo. È un centauro con le dita a pistola alle tempie, la sua posa tipica. La canotta l'ha disegnata Gemini con il logo del ponte, dopo qualche tentativo.
- **Marcello Lagna "il gorilla" (#3):** esulta battendosi il petto, per questo è "il gorilla". È disegnato con un costume da gorilla stile mascotte e il suo viso umano scoperto: niente viso da scimmia, e si è evitato qualsiasi richiamo al colore della pelle. Lo affiancano una grigliata argentina (asado) e la bandiera dell'Argentina, dove è stato. Il baffetto l'abbiamo tolto: nella foto c'era per caso.
- **Francesco Carini "Caro" (#2):** allenatore di calcio dei bambini ed ex calciatore. Ha i capelli maculati da leopardo, un manubrio in mano perché va in palestra, sciarpa e calzettoni rossoblù del Bologna e una sciarpetta bianconera nascosta, perché da piccolo tifava Juve.
- **Francesco Giordani "J" (#9):** capitano con la fascia "C", molle sotto le scarpe perché salta tantissimo, sci e bastoncini, simboli dell'AI attorno alla testa. Nella seconda versione schiaccia una pozione scudo blu che esplode (al posto del pallone) e ha il badge "CEO" al collo; viso rifatto con le sue foto, più realistico. Dopo lo scontorno i simboli dell'AI diventano grigio-lilla: si ricolorano in neon con `data/private/caricature/card/neon-j.cjs`. La card vecchia, con il pallone, è `francesco-giordani-v1.jpg`.
- **Simone Venturi "Simo" (#14):** primo passo bruciante con scia di fiamme, fumetti, tavola da surf.
- **Tommaso Pedretti "Pony" (#20):** vice capitano con la fascia "VC". Ritardatario in skate, con colbacco, sveglia che suona e attrezzi da grafico. La mazzetta dei colori aveva una striscia rosa diventata marrone, ricolorata in arancio.
- **Samuele Morando "Sammy" (#21):** il pirata, con tricorno, benda, sciabola e pappagallo.
- **Tommaso Biscarini "King" (#23):** corona, pantaloni grigi della tuta portafortuna, telefono da social media manager, rullo da fisioterapista, pallone dei 76ers e cartello "TRUST THE PROCESS".
- **Staff, Pietro Venturi "Peppo":** elicottero coperto di melma ("sticky"), fiorentina in mano e il suo barboncino Maui; divisa nei colori Sgreeners. Caricato con `carica.ts --staff`.
- **Davide Nanni "Dede" (#22):** escursionista con zaino, bastoncini, berretto e cerotti da fisioterapia (kinesio). Viso rifatto con foto nuove (seconda versione); card vecchia: `davide-nanni-v1.jpg`.
- **Filippo Corriere "Speedy" (#30):** corre tra i pacchi e un ghepardo da corsa sfinito non gli sta dietro. Flash e Usain Bolt Gemini non li disegna (personaggio protetto e persona famosa). Il disegno tocca il bordo destro: card fatta con `--ancora-destra`.
- **Simone Trisolini "Triso" (#00):** palloni che volano ovunque (tira da tre da ogni posizione), fischietto e lavagnetta perché allena, bici elettrica e una ciotola di riso.
- **Staff, Francesco Cassanelli "Cassa" (allenatore):** canotta verde "CASSA 8" della Masi, lavagnetta e fischietto, sciarpa rossoblù, soldi ovunque e la sagoma di LeBron con la canotta 23.
- **Staff, Cesare Betti (vice):** altissimo, canotta verde della Masi 21, pallone sul dito, catena e stereo (rap).
- **Staff, Aleandro Alushi (statistiche):** catapulta che lancia il pallone, attrezzatura da arrampicata, pallone da calcio e tablet con i grafici.

**In corso:**

- **Tutta la rosa e lo staff 2026-27 sono fatti.**
- `data/private/caricature/riferimento-caricature.jpg`: tutte le caricature in un'unica immagine, da allegare a Gemini come riferimento quando "dimentica" lo stile. Va rifatta quando se ne aggiungono altre.
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
   `--ombra` aggiunge un'ombra a terra, da usare se Gemini non l'ha disegnata. `--migliora` serve per i disegni piccoli o sgranati: li ingrandisce 2x e toglie la grana. `--ancora` serve quando il disegno tocca il bordo sinistro e quello in basso, per esempio un canestro tagliato: lo appoggia a filo dei bordi della card invece di centrarlo. `--ancora-destra` fa lo stesso per il bordo destro. Il colore esatto dello sfondo lo misura dai bordi, perché Gemini non dà sempre un magenta puro. Lo script crea anche `<slug>-figurina.jpg` a 900×1125.
3. **Sul sito** (poi `npm run photos:avatar` per centrare il viso nel tondino):
   ```bash
   npx tsx --env-file-if-exists=.env.local scripts/caricature/carica.ts <slug> data/private/caricature/card/<slug>-figurina.jpg 2026-27
   ```
   Per lo staff si aggiunge `--staff` con lo slug del membro dello staff.

## Easter egg: tiri liberi e versioni evil

- Nella pagina *Staff* 2026-27, alla prima visita si apre un minigioco: due tiri liberi davanti al coach, si ferma il cursore nella zona verde. Dopo la prima volta si riapre dal pallone in fondo alla pagina.
- Basta sbagliarne uno: "Hai fatto arrabbiare il coach!" e si sbloccano le versioni evil di Cassanelli (trapianto di capelli) e Cesare Betti. Restano visibili sotto lo staff, solo su quel telefono (localStorage), e si aprono in grande.
- Le immagini stanno nello storage, in `staff/easter-egg/<slug>-evil.jpg`; gli originali e le figurine in `data/private/caricature/evil/`. Quella del coach era uno screenshot del sito con le frecce del visualizzatore: `pulisci-coach.cjs` le toglie.
- Codice: `src/components/staff-easter-egg.tsx`; le foto e la stagione sono in cima alla pagina Staff.

## Tondino del giocatore (avatar)

- Il tondino mostra il viso: ogni foto di stagione ha un ritaglio, `season_rosters.avatar_crop`, che lo script trova con il rilevamento del viso. Funziona anche sulle caricature.
- Quando cambia una foto il ritaglio torna vuoto: va rilanciato `npm run photos:avatar`, che completa solo quelli mancanti. Finché manca, il tondino mostra la parte alta della foto.
- Nel profilo del giocatore il tondino e le foto delle stagioni si aprono in grande toccandole. Nella pagina Staff si aprono toccando la figurina.

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
- **Statistiche:** ordine delle colonne MIN · PTS · TIRI · TIRI% · 3P · 3P% · TL · TL% · RO · RD · AST · REC · STP · PP · F · +/-. Le tabelle si ordinano toccando l'intestazione. Nei totali MIN sono i minuti totali e MPG la media a partita, come PTS e PPG.
- **Pagine delle statistiche:** tre schede, *Leader*, *Totali e medie* e *Record*. Il filtro per fase vale per le prime due; la scelta "Per 30 minuti" sta solo dentro *Totali e medie* e cambia la tabella, non i leader.
- **Schede delle altre squadre:** dalla classifica si tocca il nome di una squadra (`/stagioni/<stagione>/classifica/<squadra>`). Ci sono record, punti fatti e subiti, casa e trasferta, stato di forma, parziali medi per quarto, le partite contro di noi e tutti i risultati, presi dal Livescore CSI. Le formazioni degli avversari non ci sono: il Livescore non le pubblica.
- **Record:** quelli personali sono nella scheda del giocatore, di sempre o di una stagione (PTS, RT, AST, REC, STP in una partita). Quelli di squadra stanno nelle statistiche, nella scheda *Record*: in quelle di stagione i record della stagione, in *All time* quelli di sempre con il selettore delle stagioni. Mostrano le 3 migliori prestazioni per statistica e i record delle partite (più punti, vittoria più larga, meno punti subiti).
- **App "Sgreeners Admin" sul telefono:** da Safari, su una pagina `/admin`, Condividi → Aggiungi alla schermata Home. Crea un'icona a parte (logo con la banda ADMIN) che si apre direttamente su *Admin → Partite*. Il login va rifatto una volta dentro l'app, perché non lo condivide con Safari. Manifest in `src/app/manifest-admin.webmanifest/route.ts`, icona in `src/app/admin/apple-icon.png`.
- **Suono all'apertura dell'app:** provato e tolto, l'utente non lo vuole.
- **Statistiche a bordo campo (diretta):** il fallo ferma il tempo da solo ed è in rosso; i falli di chi è in campo si vedono accanto ai punti (giallo a 3, rosso da 4). "📊 Statistiche" apre il tabellino della partita in corso (minuti, punti, falli, tiri…), senza i brick. Nella scelta del giocatore i riquadri sono grandi. Se si cambia quarto per sbaglio, finché non si registra niente nel nuovo quarto c'è "↶ Torna al quarto precedente". I minuti si mostrano in minuti e secondi (15:54), anche nei box score e nelle medie.
- **Loud ass brick 🧱:** pulsante rosso nella diretta, battuta della squadra per airball e tabellate. Si sceglie il tiro (TL, 2, 3) e chi l'ha sbagliato: nelle statistiche resta un tiro sbagliato normale. Il brick è una cosa a parte, che vediamo solo noi: sotto il pulsante cresce un muro, un mattone per brick con il nome di chi l'ha tirato; toccandolo si vede chi l'ha costruito, con le figurine. Non compare nel tabellino né nelle statistiche. Colonna `live_events.brick`.
- **Livescore:** il controllo rapido della sera lo lancia cron-job.org (job "Livescore Sgreeners"); serve solo il nostro girone.
