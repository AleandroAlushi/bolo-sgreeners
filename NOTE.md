# Note di lavoro — Bolo Sgreeners

Quello che serve sapere per continuare il progetto e che non si capisce leggendo il codice.
Il README rimanda alla documentazione (`docs/`, `CONTRIBUTING.md`); qui ci sono abitudini, decisioni prese e lavori in corso.

## Come lavoriamo

- Si parla in **italiano**. Ogni modifica va su un ramo, poi PR su GitHub (`AleandroAlushi/bolo-sgreeners`), poi controllo di Vercel, poi **squash merge**. Il merge si fa solo con l'ok dell'utente.
- **`main` è protetto** (dal 23/11/2026): serve una PR con un'approvazione. Le PR aperte dall'account dell'utente le unisce Claude con `gh pr merge <n> --squash --admin --delete-branch`, dopo l'ok in chat (la regola è nelle impostazioni di Claude Code dell'utente).
- **Collaboratore:** Federico Hrvatin "Chicco" (`federico53`). Le sue PR le approva l'utente. Regole per chi contribuisce in `CONTRIBUTING.md`.
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

Al posto delle foto, ogni giocatore ha una caricatura in stile figurina del Fantacalcio.

**Dove sta la caricatura** (dal 20/11/2026):
- È la **foto predefinita** di ogni giocatore (`players.photo_path`, con il ritaglio del viso in `players.avatar_crop`) e di ogni membro dello staff (`staff_members.photo_path`). La vedi nel tondino, nelle statistiche e nella leaderboard, nella diretta e nelle grafiche.
- È anche la **foto di stagione 2025-26** di chi era nel roster o nello staff 2025-26. I nuovi arrivi 2026-27 (Simo, Sammy, Chicco, Speedy, Cesare Betti) ce l'hanno solo come predefinita.
- La **2026-27 non ha foto di stagione**: lì arriveranno le GIF.
- Nelle viste, `photo_path` è la foto da mostrare (quella di stagione, se no la predefinita) e `season_photo_path` è solo quella della stagione. Le pagine Squadra e Staff e le foto delle stagioni nel profilo usano `season_photo_path`.
- Le nuove caricature si caricano come predefinite con `carica.ts --predefinita` e, se serve, anche come foto di stagione 2025-26. Il disegno lo fa **Gemini**, perché Claude non genera immagini. Noi lo scontorniamo e lo mettiamo sullo sfondo Sgreeners.

**Fatti** (sul sito come foto predefinite e foto 2025-26; card e disegni originali in `data/private/caricature/`):
- **Federico Hrvatin "Chicco" (#32):** la piovra, con tentacoli viola al posto delle braccia e una tastiera (studia ingegneria informatica). Seconda versione su sfondo verde: pantaloncini neri come gli altri, macchinina arancione con il turbo dietro di lui (richiamo a Rocket League, disegnata originale) e una larva sul tentacolo. Card fatta con `--chiave verde --proteggi` sulle scarpe verde lime, che altrimenti lo scontorno schiariva. Card vecchia: `chicco-hrvatin-v1.jpg`.
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
   `--ombra` aggiunge un'ombra a terra, da usare se Gemini non l'ha disegnata. `--migliora` serve per i disegni piccoli o sgranati: li ingrandisce 2x e toglie la grana. `--ancora` serve quando il disegno tocca il bordo sinistro e quello in basso, per esempio un canestro tagliato: lo appoggia a filo dei bordi della card invece di centrarlo. `--ancora-destra` fa lo stesso per il bordo destro. `--proteggi x0,y0,x1,y1` (frazioni del disegno, più zone separate da `;`) tiene pieni i colori vicini allo sfondo in quella zona, per esempio scarpe verde lime su sfondo verde. Il colore esatto dello sfondo lo misura dai bordi, perché Gemini non dà sempre un magenta puro. Lo script crea anche `<slug>-figurina.jpg` a 900×1125.
3. **Sul sito** (poi `npm run photos:avatar` per centrare il viso nel tondino; calcola anche i ritagli delle foto predefinite):
   ```bash
   npx tsx --env-file-if-exists=.env.local scripts/caricature/carica.ts --predefinita <slug> data/private/caricature/card/<slug>-figurina.jpg
npx tsx --env-file-if-exists=.env.local scripts/caricature/carica.ts <slug> data/private/caricature/card/<slug>-figurina.jpg 2025-26   # se era nella 2025-26
   ```
   Per lo staff si aggiunge `--staff` con lo slug del membro dello staff.

## Video in loop della stagione 2026-27

- Nella 2026-27, al posto della foto, ogni figurina delle pagine Squadra e Staff ha un breve video: senza audio, parte da solo e gira in loop come una GIF.
- **Si usa il video, non la GIF:** una GIF da 3 secondi pesava 2-8 MB, il video 720×900 ne pesa circa 0,3. Scelta dell'utente.
- Nella pagina Squadra il pulsante **↻** fa ripartire tutti i video insieme. Li avvia anche quando il telefono, in risparmio energetico, non li fa partire da soli.
- Colonne `season_rosters.video_path` e `season_staff.video_path`; nelle viste si chiamano `season_video_path`. La copertina sta accanto al video, con lo stesso nome e l'estensione `.jpg`.
- I video originali stanno in `data/private/gif/video/<slug>.mov`, i file pronti in `data/private/gif/out/`.
- Per caricarne uno (ffmpeg è in `~/.local/bin`):
  ```bash
  npx tsx --env-file-if-exists=.env.local scripts/video-loop/carica.ts [--staff] <slug> data/private/gif/video/<slug>.mov [--da=1 --durata=3 --alto=0.6] [--prova]
  ```
  - Con `--prova` prepara solo i file, senza caricare niente.
  - `--alto` decide dove tagliare in verticale per il formato 4:5: 0 è in alto, 1 in basso.
- Il tondino, le statistiche e il resto continuano a usare la caricatura.
- **Numero di maglia sbagliato** (riprese fatte prima delle divise nuove): `data/private/gif/cambia-numero.cjs <in.mp4> <vecchio> <nuovo> <out.mp4>`.
  - Segue il numero, anche tramite i loghi bianchi sulle spalle quando le mani lo coprono, e lo ridisegna con il font Teko.
  - Usa opentype.js e @fontsource/teko, che vanno installati accanto allo script.
  - Fatto per Simo (9 → 14), Bertuz (8 → 13) e Speedy (22 → 30).
  - Il video finito si carica con `carica.ts --pronto`.
- **Teo:** versione intera, con la camera che sale dalle gambe; copertina al secondo 3,5 (`--copertina=3.5`).
- **Senza video:** J (Giordani) e Peppo (Pietro Venturi) non c'erano alle riprese. Nella 2026-27 hanno la caricatura come foto di stagione (migration `20261120000300`).
- **Triso e King (Biscarini):** video aggiunti il 24/11/2026, girati dopo e arrivati da WhatsApp (576×1024, qualità più bassa degli altri in 4K).
  - Erano più lontani e più in basso nell'inquadratura: ritaglio fatto a mano con ffmpeg (`crop=440:550:82:310` per Triso, `crop=440:550:90:280` per King, poi come in `carica.ts`), confrontando la grandezza del viso con le altre GIF. Caricati con `carica.ts --pronto`.
  - La caricatura come foto di stagione 2026-27 è rimasta: dove c'è il video il sito mostra il video.

## Easter egg: tiri liberi e versioni evil

- Nella pagina *Staff* 2026-27, alla prima visita si apre un minigioco: due tiri liberi davanti al coach, si ferma il cursore nella zona verde. Dopo la prima volta si riapre dal pallone in fondo alla pagina.
- Basta sbagliarne uno: "Hai fatto arrabbiare il coach!" e si sbloccano le versioni evil di Cassanelli (trapianto di capelli) e Cesare Betti. Restano visibili sotto lo staff, solo su quel telefono (localStorage), e si aprono in grande.
- Le immagini stanno nello storage, in `staff/easter-egg/<slug>-evil.jpg`; gli originali e le figurine in `data/private/caricature/evil/`. Quella del coach era uno screenshot del sito con le frecce del visualizzatore: `pulisci-coach.cjs` le toglie.
- Codice: `src/components/staff-easter-egg.tsx`; le foto e la stagione sono in cima alla pagina Staff.

## Area squadra: calendario e paste (dal 25/11/2026)

- **Calendario mensile** (frecce per cambiare mese): allenamenti con orario (lunedì 22:00–23:30, giovedì 21:30–23:00, colonna `training_schedule.times`), partite con orario e durata ipotizzata di 1h30, "Auguri <soprannome>!", paste e pause. Codice: `src/components/team-calendar.tsx`, `src/lib/domain/team-calendar.ts`.
- **Pause:** Natale (24/12–6/1) e Pasqua (25–30/3/2027), come le scuole dell'Emilia-Romagna, perché ci si allena in una scuola. Le vacanze scolastiche si aggiungono in *Admin → Area squadra*.
- **Turni delle paste 2026-27** (decisi con l'utente, migration `20261125000400`): 3 per mese da dicembre a maggio. Vicino al compleanno chi lo compie in stagione (Teo 7/12, Simo 21/1, Macca 25/2, Dede 22/3, Triso 5/4); gli altri (compleanno già passato o estivo) riempiono i mesi: Peppo 10/12, Speedy 17/12, Pony 7/1, King 14/1, Bertuz 4/2, Sammy 15/2, Biolco 4/3, Giamma 11/3, J 15/4 (a marzo forse non è a Bologna), Cesare 26/4, Caro 6/5, Aleandro 17/5, Marçelo 27/5. Già portate: Cassa e Chicco.
  - Il giorno delle paste resta `paste_day` ("mm-gg"); se diventa giorno di partita (es. playoff), il turno slitta da solo al primo allenamento libero.
  - **Portate:** casella "Paste portate nel <stagione>" nella scheda del giocatore o dello staff in Admin (`private_profiles.paste_done_season`).
- **WhatsApp:** nella sezione dei turni, "Messaggio" (testo con i mesi in grassetto) e "Immagine" (storia 1080×1920 da `/grafiche/paste`, solo per chi entra nell'area squadra).
- **Compleanni** da gennaio a dicembre, divisi per mese.
- Soprannomi dello staff in `staff_members.nickname` (Peppo, Cassa, Ceso).
- **Playoff:** a fine novembre 2026 il CSI non li ha ancora pubblicati; negli anni scorsi quarti ad aprile, semifinali a metà maggio, finale a inizio giugno.

## Tondino del giocatore (avatar)

- Il tondino mostra il viso: ogni foto di stagione ha un ritaglio, `season_rosters.avatar_crop`, che lo script trova con il rilevamento del viso. Funziona anche sulle caricature.
- Quando cambia una foto il ritaglio torna vuoto: va rilanciato `npm run photos:avatar`, che completa solo quelli mancanti. Finché manca, il tondino mostra la parte alta della foto.
- Nel profilo del giocatore il tondino e le foto delle stagioni si aprono in grande toccandole. Nella pagina Staff si aprono toccando la figurina.

## Grafiche Instagram (stile Canva, dal 24/11/2026)

- Lo stile è quello delle grafiche Canva dell'utente: sfondi già pronti (basi) con sopra solo scritte e foto.
  - **Sul sito** (*Admin → Grafiche*): basi in `assets/grafiche/`, codice in `src/lib/graphics/social/` (`cards.tsx`; `layout.tsx` posiziona il testo con le misure dei font in `metrics.ts`, perché Satori non le sa calcolare; `photo.ts` colora e sfuma le foto).
  - **Sul server**, per le grafiche fatte a mano: `data/private/grafiche/` (fuori da GitHub). `recap.py <dati.json> <uscita>` fa il carosello; `crea_basi_v3.py` rifà le basi di Box score, Leader e Andamento.
  - Prova senza database: `NODE_OPTIONS=--conditions=react-server npx tsx scripts/graphics-preview.tsx <cartella> data/private/grafiche/giocatori`.
- **Presentazione:** post con due giocatori (primo piano e dietro) colorati con la sfumatura della base, scelti dalla galleria; storia senza foto, orario senza "ORE", palestra su due righe. Sigle "BSG VS ZVC", "AT" in trasferta.
- **Carosello del dopo partita:** finale (noi sempre in alto), MVP, box score, leader.
  - **MVP:** punti, rimbalzi, il migliore fra assist e recuperi, % al tiro; foto in partita a figura intera (la prima della galleria o quella scelta), altrimenti il mezzo busto.
  - **Leader:** ordine assist, punti, recuperi, rimbalzi; **sempre il mezzo busto**, alla stessa scala. **A parità vince chi ha giocato meno minuti**, poi chi ha più punti.
- **Didascalia:** con ogni carosello Claude scrive anche la didascalia (la pubblica l'utente). Stile in `data/private/grafiche/modelli/esempi/didascalia.txt`: tre paragrafi in prima persona plurale (la partita dai parziali; protagonisti, record, career high; prossima partita e "non mancate! 💚"). Niente fatti inventati.
- **Watermark di Canva:** non si toglie. Le basi con il watermark si rifanno da zero (è così che sono nate Box score e Leader).
- **Cartelle sul server** (`data/private/grafiche/`):
  - `modelli/post/` e `modelli/storia/`: le basi; `modelli/esempi/`: le grafiche Canva di riferimento;
  - `giocatori/mezzobusto/<slug>.png`: mezzo busto, tutti alla stessa scala (testa → numero di maglia, `normalizza_mezzobusto.py`); le foto di partenza in `originali-foto/`;
  - `giocatori/foto-partita/<slug>/<slug>-N.png`: foto in partita (`organizza_foto_partita.py`), più `squadra/`;
  - `partite/<data>-<avversario>/`: le grafiche fatte per una partita.
- **Scontorni:** con rembg (`rembg-env/bin/python scontorna_rembg.py <cartella> [--modello birefnet-portrait]`), partendo dalle foto originali o con lo sfondo bianco. **Le foto vanno mandate con `scp`**: dalla chat arrivano senza trasparenza e senza nome.
  - Sul sito: mezzo busto in `season_rosters.cutout_path` (2026-27: 15 giocatori; Peppo arriva a breve con il video, J è via fino a marzo), foto in partita in `media/foto-partita/<slug>/` (44 foto).
- **Numero di maglia vecchio nelle foto:** `cambia_numero_foto.py <in.png> <nuovo> <out.png>` (Teko, colori della maglia). Fatto per Bertuz 13, Sammy 21, Simo 14, Speedy 30.
- **Sigle e loghi degli avversari** in *Admin → Squadre* (Zola Vice: ZVC).
- **Niente tag Instagram** dei giocatori nelle didascalie: scelta dell'utente.

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

## Area admin (riordinata il 22/11/2026)

- **Menu:**
  - sul computer è una colonna a gruppi: *Partita* (Oggi, Partite, Grafiche), *Squadra* (Giocatori, Staff, Foto e video, Area squadra), *Campionato*, *Altro*;
  - sul telefono è una barra in basso: Oggi · Live · Partite · Grafiche · Altro;
  - "Statistiche live" è sempre in evidenza.
- **Oggi** è la pagina d'ingresso, anche dell'app Sgreeners Admin:
  - la diretta aperta da riprendere;
  - la prossima partita con "Inizia le statistiche live";
  - l'ultima partita con le grafiche;
  - ricerca, scorciatoie e feedback.
- **Ruolo "Statistiche" (`stats`)**, pensato per Peppo: diretta e salvataggio del box score, Oggi e grafiche (anche il caricamento delle loro foto). Niente roster, partite, classifiche e stagioni. Si assegna in *Area squadra → Accessi*.
- **Dopo il salvataggio della diretta** compare "Crea le grafiche del dopo partita", che apre le grafiche già su quella partita (`/admin/grafiche?partita=<id>`).
- **Convocati della diretta:** partono da quelli dell'ultima diretta salvata, se almeno 5 sono nel roster; altrimenti dagli attivi.
- **Partite:** elenco a schede, con il filtro Da giocare / Giocate / Tutte e il pulsante Live sulle partite da giocare.
- **Cerca** (`/admin/cerca`): giocatori, staff, squadre e partite.
- **Foto e video** (`/admin/foto`), una scheda per persona della stagione:
  - caricatura, cioè la foto predefinita;
  - video in loop: il telefono lo prepara da solo, 4:5 a 720×900, senza audio, al massimo 6 secondi, in MP4 con la copertina, e lo carica nello storage;
  - scontorno a mezzo busto;
  - foto in partita, cioè la galleria delle grafiche.

  Per i video serve Safari sull'iPhone o un Chrome aggiornato.
- **Archivio**: import dei box score, discrepanze e registro degli import, che non servono più tutti i giorni.
- **Alias tolti dall'admin:** i giocatori si riconoscono da nome, cognome e soprannome. Le tabelle `player_aliases` e `team_aliases` restano nel database, perché l'import dei box score nell'Archivio le usa da solo per i file vecchi. Le statistiche non dipendono dagli alias.
- **Provare prima del merge:** ogni PR ha il suo sito di prova su Vercel (per il ramo X: `bolo-sgreeners-git-X-aleandrini.vercel.app`).
  - Si apre con il login Vercel; poi si entra nell'admin con il proprio account.
  - **I dati sono quelli veri**, e una barra gialla lo ricorda.
  - Le migration partono solo al merge: nell'anteprima ciò che le richiede, per esempio il ruolo Statistiche, ancora non c'è.

## Altre cose decise

- **Staff:** in tutte le stagioni Pietro Venturi è dirigente accompagnatore e Aleandro Alushi fa le statistiche.
- **Chi è giocatore e staff** (oggi Aleandro) è una persona sola: `staff_members.player_id` lo collega al giocatore.
  - Nella pagina *Giocatori* sta tra i giocatori, con "Staff · ruolo"; sotto c'è la sezione *Staff* con gli altri.
  - Il suo profilo conta e mostra anche le stagioni da staff, con le loro foto e video.
- **Video ritagliati di nuovo:** Dede con `--alto=0.85`, Caro con `--alto=0.65`.
- **Federico Rossi:** la mano "mistero" è una gag voluta.
- **Statistiche:** ordine delle colonne MIN · PTS · TIRI · TIRI% · 3P · 3P% · TL · TL% · RO · RD · AST · REC · STP · PP · F · +/-. Le tabelle si ordinano toccando l'intestazione. Nei totali MIN sono i minuti totali e MPG la media a partita, come PTS e PPG.
- **Pagine delle statistiche:** tre schede, *Leader*, *Totali e medie* e *Record*. Il filtro per fase vale per le prime due; la scelta "Per 30 minuti" sta solo dentro *Totali e medie* e cambia la tabella, non i leader.
- **Schede delle altre squadre:** dalla classifica si tocca il nome di una squadra (`/stagioni/<stagione>/classifica/<squadra>`). Ci sono record, punti fatti e subiti, casa e trasferta, stato di forma, parziali medi per quarto, le partite contro di noi e tutti i risultati, presi dal Livescore CSI. Le formazioni degli avversari non ci sono: il Livescore non le pubblica.
- **Record:** quelli personali sono nella scheda del giocatore, di sempre o di una stagione (PTS, RT, AST, REC, STP in una partita). Quelli di squadra stanno nelle statistiche, nella scheda *Record*: in quelle di stagione i record della stagione, in *All time* quelli di sempre con il selettore delle stagioni. Mostrano le 3 migliori prestazioni per statistica e i record delle partite (più punti, vittoria più larga, meno punti subiti).
- **App "Sgreeners Admin" sul telefono:** da Safari, su una pagina `/admin`, Condividi → Aggiungi alla schermata Home. Crea un'icona a parte (logo con la banda ADMIN) che si apre su *Admin → Oggi*: la prossima partita con il pulsante per le statistiche live. Dal 22/11/2026 l'app copre tutto il sito, quindi anche la diretta resta dentro l'app. Chi l'aveva già installata deve toglierla e rimetterla, perché il telefono rilegga la configurazione. Il login va rifatto una volta dentro l'app, perché non lo condivide con Safari. Manifest in `src/app/manifest-admin.webmanifest/route.ts`, icona in `src/app/admin/apple-icon.png`.
- **Suono all'apertura dell'app:** provato e tolto, l'utente non lo vuole.
- **Statistiche a bordo campo (diretta):** il fallo ferma il tempo da solo ed è in rosso; i falli di chi è in campo si vedono accanto ai punti (giallo a 3, rosso da 4). "📊 Statistiche" apre il tabellino della partita in corso (minuti, punti, falli, tiri…), senza i brick. Nella scelta del giocatore i riquadri sono grandi. Se si cambia quarto per sbaglio, finché non si registra niente nel nuovo quarto c'è "↶ Torna al quarto precedente". I minuti si mostrano in minuti e secondi (15:54), anche nei box score e nelle medie.
- **Statistiche live (dal 25/11/2026):** solo admin e "Statistiche" (Aleandro e Peppo). L'account di squadra `team` non le vede più: niente link nell'Area squadra, pagine e permessi del database (`is_staff()`) riservati. Le pagine restano in `/area-squadra/live`, ma ci si arriva dall'admin.
- **Chat della diretta:** nella pagina della partita, sotto il punteggio, solo mentre la diretta è aperta. Niente account: chi scrive mette il suo nome, salvato sul telefono.
  - Il database (`live_chat_send`) rifiuta parolacce, insulti e bestemmie (anche scritti con numeri o lettere ripetute, es. c4zzzo), link, nomi offensivi, più di un messaggio ogni 3 secondi o 8 al minuto, doppioni.
  - Admin e Statistiche, entrati con il loro account, vedono sotto ogni messaggio **Nascondi** e **Blocca** (blocca quel telefono e nasconde tutti i suoi messaggi) e il pulsante **Chiudi la chat**.
  - Niente blocco per indirizzo IP: in palestra molti usano lo stesso Wi-Fi e si bloccherebbe tutta la tribuna. Chi cancella i dati del browser può tornare a scrivere: per quello c'è "Chiudi la chat".
  - Il nome non è verificato: chiunque può scrivere come "Teo". Scelta voluta, per semplicità.
  - **Colori dei nomi:** uno per persona in ordine di arrivo: verde neon, arancione, azzurrino, giallo, poi da capo (la quinta persona riprende il verde neon). Variabili `--chat-1…4` in `globals.css`, più scure nel tema chiaro. Accanto al proprio nome c'è "(tu)".
  - Admin e Statistiche: **Nascondi** e **Blocca** compaiono toccando il messaggio.
  - Il pulsante **−** riduce la chat a una riga (con il numero di messaggi), il **+** la riapre; il telefono se lo ricorda.
  - La chat **non** va nella schermata di chi prende le statistiche (`/area-squadra/live`), per non distrarlo.
- **Loud ass brick 🧱:** pulsante rosso nella diretta, battuta della squadra per airball e tabellate. Si sceglie il tiro (TL, 2, 3) e chi l'ha sbagliato: nelle statistiche resta un tiro sbagliato normale. Il brick è una cosa a parte, che vediamo solo noi: sotto il pulsante cresce un muro, un mattone per brick con il nome di chi l'ha tirato; toccandolo si vede chi l'ha costruito, con le figurine. Non compare nel tabellino né nelle statistiche. Colonna `live_events.brick`.
- **Livescore:** il controllo rapido della sera lo lancia cron-job.org (job "Livescore Sgreeners"); serve solo il nostro girone.
  - **Sito nuovo del CSI (metà novembre 2026):** classifica e risultati si leggono da `assets/json/getProjectSheetSection.php?project_id=…&section=ranking|results` (quello che carica `league.php`); le nostre partite dalla tabella risultati. Le pagine vecchie rispondono vuote.
  - Se a stagione in corso non arriva nessuna partita, l'aggiornamento **fallisce** (errore rosso su GitHub): di solito vuol dire che il sito CSI è cambiato di nuovo.
  - Se il totale sul Livescore non torna con i parziali (es. 162-163 con parziali 84-85) valgono i parziali, con un avviso nel riepilogo.
- **Giocatore in viaggio, "personaggio da sbloccare":** `season_rosters.away_until` e `away_note`. Fino a quella data, nella pagina Squadra la figurina è la **sagoma nera** della caricatura con il "?" e il lucchetto (sagoma in `media/easter-egg/sagome/<slug>.png`, originale in `data/private/caricature/sagome/`). Toccandola parte il minigioco **"L'Odissea"** (`src/components/odyssey.tsx`): Polifemo (si tira quando chiude l'occhio), le Sirene (si tocca solo il pallone vero), Scilla e Cariddi (si passa nella corsia libera), tiro finale a Bologna. Vinto, la figurina si sblocca su quel telefono (localStorage): caricatura, badge "Sbloccato" e la nota. Dopo la data torna normale da sola. J (Giordani) è a Itaca a studiare: bloccato fino al 28/02/2027 (dal 1° marzo torna normale), "Torno a marzo".
- **Pagina della partita giocata:** sotto i Parziali c'è l'**Andamento** (dalla diretta del sito, solo per le partite seguite con le statistiche live): si ingrandisce, si scorre e toccando si vede il punteggio di ogni momento. Calcolo in `src/lib/live/flow.ts`.
- **Condividi:** sulle partite da giocare, al posto di "Aggiungi al calendario" (il calendario si aggiunge dalla stagione). Apre subito la condivisione del telefono con un messaggio pronto (squadre, giorno e ora, palestra, mappa, link); dove il browser non la ha, un menu con WhatsApp e Copia. I menu a tendina si posizionano per restare dentro lo schermo.
- **Pubblicazione su Instagram:** non è automatica, la fa l'utente (si può programmare con Meta Business Suite).
