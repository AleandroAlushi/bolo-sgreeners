# DATI IDENTIFICATI — Fase 0

Analisi del pacchetto `Bolo_Sgreeners_Fonti_per_Claude.zip` (ottobre 2026).
Ogni dato riporta la fonte da cui proviene. Legenda fonti:

| Sigla | Fonte | Ruolo |
| --- | --- | --- |
| **HTML** | 50 box score esportati dall'app *Easy Stats for Basketball* (49 unici) | statistiche partita (primaria) |
| **XLS-S** | `Sgreeners_stats_COMPLETO.xlsx` | storico ricostruito: alias, log partita, statistiche squadra |
| **XLS-C** | `Sgreeners_calendario_COMPLETO.xlsx` | storico ricostruito: calendario Sgreeners, record per fase |
| **XLS-M** | `Bolo_Sgreeners_matching_CSI_COMPLETO.xlsx` | matching soprannomi avversari ↔ nomi CSI, livello di confidenza |
| **CSI-SS** | 22 screenshot del Livescore CSI Bologna (cartella 04) | risultato ufficiale, parziali, orario, palestra, giornata |
| **CSI-PDF** | `PCA - Silver - Livescore CSI Bologna.pdf` | classifica ufficiale 2023-24 |
| **PDF-BS** | 3 report PDF *Basketball Stats Assistant* (immagini) | box score di 3 partite 2023-24 (trascritti in XLS-S) |
| **FOTO** | 7 foto di appunti/fogli statistiche | statistiche parziali di 3 partite (trascritte in XLS-S) |
| **WEB** | articolo castelfrancobasket.it (citato in XLS) | risultato + punti per giocatore del 13/11/2023 |

> **Aggiornamento (22/10/2026)**: il Livescore CSI è ora raggiungibile e i suoi dati sono in
> `data/curated/livescore.json` (`npm run livescore:sync`). Vedi la sezione 10. Il logo ufficiale
> viene dal Livescore e lo stile dalle grafiche Instagram (sezione 9); numeri di maglia
> principali, staff e verifica delle discrepanze sono stati forniti dalla squadra (sezione 11).

---

## 1. Stagioni e competizioni

| Stagione | Nome squadra CSI | team_id CSI | Fasi (project_id CSI) | Gare Sgreeners | Fonte |
| --- | --- | --- | --- | --- | --- |
| 2023-24 | Bolo Sgreeners | 2338 | PCA Silver (432) · Playoff (id n.d.) | 16 RS + 4 PO = 20 | XLS-C, CSI-SS, CSI-PDF |
| 2024-25 | Revolution - Bolo Sgreeners | 2804 | PCA Silver A (582) · Poule Super Silver B (658) · Play-Off Super-Silver (703) | 14 + 6 + 3 = 23 | XLS-C, link |
| 2025-26 | GG Garden/Revolution - Bolo Sgreeners | 3321 | PCA Silver (759) · Quarti Playoff Super Silver (832) | 15 + 3 = 18 | XLS-C, link |
| 2026-27 | — | — | nessun dato nelle fonti | 0 | specifica (4° anno) |

Record per stagione (XLS-C, verificato sommando le partite): 2023-24 **7-13** (PF 1097, PA 1150),
2024-25 **15-8** (1318-1330), 2025-26 **13-5** (1104-941).

## 2. Partite

**61 partite** degli Sgreeners identificate (XLS-C). Copertura statistica:

| Copertura | N. | Dettaglio |
| --- | --- | --- |
| Box score HTML | 49 | 2023-24: 10 · 2024-25: 22 · 2025-26: 17 |
| Box score PDF (trascritto in XLS-S) | 3 | 07/11, 28/11, 04/12/2023 |
| Foto appunti (trascritte in XLS-S) | 3 | 26/10/2023, 30/10/2023, 13/03/2026 (parziali) |
| Solo punti per giocatore (WEB) | 1 | 13/11/2023 |
| Solo risultato CSI | 4 | 15/12/2023, 15/01, 22/01, 30/01/2024 |
| Solo risultato, senza data | 1 | Poule 2024-25 vs Pallacanestro Felsinea 63-54 (ricavato dai totali CSI, confermato dall'utente) |

- **Risultati ufficiali con parziali, orario, palestra, indirizzo e codice gara (CSI-SS)**: tutte
  le 16 gare di regular season 2023-24, più 24/01/2025 e 13/03/2026 (18 partite).
- **Punteggi per quarto da HTML**: solo 1 file (23/04/2026). Gli altri export recenti hanno il
  grafico "Game Flow" solo come immagine (non estraibile in modo affidabile).
- **Casa/trasferta**: 2023-24 da CSI-SS; 2024-25 e 2025-26 da XLS-C (probabilmente derivato
  dall'app, che però non è affidabile su questo: in 1 caso su 6 verificabili il lato "home"
  dell'HTML è opposto al CSI).
- **Calendario completo dei campionati** (partite tra altre squadre): **non disponibile** in
  nessuna fonte del pacchetto.

## 3. Giocatori e alias

**19 giocatori** con nome reale (XLS-S, foglio Alias e aggregati), tutti mappati dai soprannomi
usati negli HTML. Alias principali (XLS-S, confermati sugli HTML):

| Giocatore | Alias nei file | Numeri visti (HTML) |
| --- | --- | --- |
| Andrea Maccaferri | Macca | 11 |
| Luca Biolchini | Bilks, Biolco | 15 |
| Tommaso Pedretti | Pony, Drunz, Pedro | 20 |
| Tommaso Biscarini | King, Bisca | 23 |
| Simone Trisolini | Triso | 00 |
| Federico Hrvatin | Chicco (**solo con #32**), Cicci | 32 |
| Francesco Carini | Caro, Chicco (**solo con #2**) | 2 |
| Francesco Grandi | Tollo | 33 |
| Francesco Giordani | J, Jordan | 9 |
| Gianmarco Tomba | Giamma | 18 |
| Federico Rossi | Fede | 0 |
| Lorenzo Conti | Count, Lollo | 10 |
| Aleandro Alushi | Alu | 69 |
| Jacopo Giovagnoni | Apo | 21 |
| Luca Curati | Lil, Curat, Cura | 37, 7, 32 |
| Matteo Mazzanti | Teo, Matte | 91, 1 |
| Davide Nanni | Dede | 69, 7, 22 |
| Filippo Bertuzzi | Bertuz | 8 |
| Marcello Lagna | Marçelo, Marci | 3, 7 |

- Il numero di maglia cambia tra stagioni e talvolta dentro la stessa stagione → il numero va
  salvato per stagione (roster) **e** per partita.
- "Chicco" è **ambiguo**: #32 = Hrvatin, #2 = Carini; senza numero (foto 2023) = non attribuibile
  (XLS-S lo tiene come "Chicco (non attribuito)").
- Ruoli, foto, date di nascita: **non presenti** nel pacchetto fonti. Si inseriscono dall'admin
  (le date di nascita sono riservate all'area squadra); numeri principali e staff sono arrivati
  poi dalla squadra (sezione 11).

## 4. Statistiche disponibili

| Fonte | Statistiche |
| --- | --- |
| HTML 2024 (14 colonne) | FG (2+3) M-A, 3PT M-A, FT M-A, OREB, DREB, falli, recuperi, perse, stoppate, assist, +/-, minuti, punti |
| HTML nov 2024 "Pesci" (12 col.) | come sopra **senza** +/-, minuti e senza totali squadra |
| HTML 2024-26 (17 colonne) | come 14 colonne + percentuali (ignorate perché derivabili); giocatori assenti con "-" |
| HTML 05/02/2024 | in più: shot chart con coordinate e **ID interni** dei giocatori (59 tiri) |
| Totali squadra (HTML) | per entrambe le squadre, stesse colonne (avversari: niente giocatori) |
| PDF-BS (via XLS-S) | minuti, punti, 2P/3P/TL, OREB/DREB, AST, TOV, STL, BLK, falli (+ efficienza nel PDF) |
| FOTO (via XLS-S) | sottoinsiemi variabili (punti, rimbalzi, perse, falli…); molte celle vuote = non registrate |
| WEB (via XLS-S) | solo punti |

Non presenti: quintetti, eventi play-by-play, rotazioni, valutazione (tranne PDF).

## 5. Squadre avversarie (nomi ufficiali CSI)

Da XLS-M/XLS-C, verificati con CSI-SS dove possibile. Le stesse società compaiono con nomi
commerciali diversi nelle varie stagioni:

- **CSI Sasso Marconi** · **Porretta Basket** (2025-26: *Porretta Basket BLU*) · **Fagian's**
  (*Fagian's Monteveglio*, *Easy Drive/Intim8 Fagian's Monteveglio*) · **Saragozza Goats** ·
  **Academy Valsamoggia** (*Valsamoggia Academy*) · **Studio Casa M CSI Castelfranco** ·
  **Trattoria Giampi e Ciccio / Bluebear Bar - QSZ Basket** · **Ghepard 2003** · **PGS Igea** ·
  **Golden Stalla Warriors** (*Cremeria la vecchia stalla/Pizzeria Donna Sofi - Golden Stalla Warriors*) ·
  **Bolo State Neptunes** · **La Rotonda sul pane - Diablos bakset** ·
  **L'8 Boutique - Walruses Basketball** · **Impro Savena Bridge - CMB** · **Pallacanestro Felsinea** ·
  **Nueva vida Snc - Brick Team** · **HD Bologna Basket** · **Libertas San Felice** · **Buono Burger - CMB**.

I nomi negli HTML sono **soprannomi ironici** (spesso volgari) e non vanno mostrati
pubblicamente: sono salvati solo come alias interni (visibili agli admin).

## 6. Classifiche e regolamento

- **2023-24 PCA Silver**: classifica finale completa a 9 squadre (CSI-PDF): Pos, Pti, PG, V, S,
  SSP, PF, PS, Q.C., Q.Tot. Bolo Sgreeners **5° con 18 punti** (6-10, 881-931).
- **Sistema punti dedotto da CSI-PDF** (coerente su tutte le 9 righe): vittoria 3, sconfitta 0,
  "SSP" 1 punto (interpretato come *sconfitta dopo supplementari* — **da confermare**).
  Ordinamento a parità di punti coerente con *Q.Tot = Pti/PG + PF/PS* (es. Sasso Marconi e
  Porretta a 42). Q.C. = PF/PS.
- 2024-25 e 2025-26: **nessuna classifica** nelle fonti (solo i totali Sgreeners per fase in XLS-C).

## 7. Informazioni mancanti

1. Calendari completi dei campionati (tutte le partite, non solo Sgreeners) → impossibile per
   ora calcolare classifiche complete.
2. Classifiche 2024-25 e 2025-26; formula/regolamento di poule e playoff.
3. Data, casa/trasferta e palestra della 6ª gara di Poule 2024-25 (vs Felsinea).
4. Orari/palestre di quasi tutte le gare 2024-25 e 2025-26.
5. ~~Instagram: colori ufficiali, logo in alta risoluzione~~ (risolto: sezione 9); restano le
   foto dei giocatori.
6. Ruoli e foto dei giocatori (da inserire dall'admin); stagione 2026-27 (in corso).
7. ~~Project_id CSI dei playoff 2023-24.~~ (punti 2-4 e 7 risolti dal Livescore: vedi sezione 10;
   resta il regolamento di poule e playoff.)

## 8. Incongruenze tra fonti (tutte registrate come conflitti nel database)

| # | Partita / ambito | Discrepanza | Fonte primaria → valore usato |
| --- | --- | --- | --- |
| 1 | 11/03/2024 vs CSI Sasso Marconi | HTML 46-62, CSI 48-62 | CSI → **48-62**; statistiche HTML mantenute (2 punti non attribuiti) |
| 2 | 30/10/2023 vs Ghepard 2003 | punti giocatori da FOTO = 60, CSI 62 | CSI → **62-48** |
| 3 | 13/03/2026 vs Porretta Basket BLU | data FOTO 14/03 vs CSI 13/03; punti giocatori 69 vs CSI 67 | CSI → **13/03/2026, 67-49** |
| 4 | Play-Off 2024-25 | somma punti subiti dai 3 HTML = 161, totale CSI = 162 | CSI per i totali; partita non individuabile |
| 5 | 05/02/2024 vs QSZ | HTML indica Sgreeners in trasferta, CSI in casa | CSI → **casa** |
| 6 | 6 partite HTML | giocatore con 0 minuti contato come presenza da XLS-S | HTML → **non entrato** (presenza non conteggiata) |
| 7 | 2025-26 RS | 3 gare contro Porretta Basket BLU (26/11, 12/02, 13/03) in un girone da 15 gare | l'associazione del 12/02/2026 ("Figli di troia") va verificata |
| 8 | KFC 20/04/2027 | file duplicato (hash identico) con anno errato nel nome | ignorato: la data interna è 20/04/2026 |
| 9 | 26/10/2023 e 30/10/2023 | "Chicco" senza numero nelle foto | riga non attribuita a nessun giocatore |

Verifiche superate: le statistiche di **557 righe giocatore** degli HTML coincidono al 100% con i
log di XLS-S; i risultati HTML coincidono con XLS-C/CSI tranne il caso #1; totali 2024-25 RS
(775-775) e Poule (363-393) coincidono con i totali CSI riportati in XLS-C.

Associazioni avversario ancora **"da verificare"** in XLS-M: 23/04 e 29/04/2024 (playoff →
Fagian's), 29/11/2024 (Pesci → Bolo State Neptunes), 02/12/2024 (Diavoletti → Diablos).
Nel database sono marcate con stato di verifica `to_verify`. Tutte poi confermate dal Livescore
(sezione 10).

## 9. Identità visiva

- **Logo ufficiale** (dal Livescore CSI): ponte sospeso disegnato a linee **neon** (arancio,
  ciano/azzurro, verde lime) su **fondo nero**. È in `public/brand/` (intestazione, badge
  squadra), nelle icone dell'app (`public/icons/`, `src/app/apple-icon.png`,
  `src/app/favicon.ico`) e in `assets/brand/` per le grafiche generate.
- **Stile delle grafiche @bolo.sgreeners**: fondo nero, sfumature luminose verde neon → giallo →
  ambra con grana, oro per finali e premi, numeri condensati enormi, corsivo serif per gli
  accenti ("Final Score", "Next Game"). Palette in `src/app/globals.css` (`--sg-primary`,
  `--sg-secondary`, `--sg-accent`, `--sg-gold`); font Bebas Neue, Playfair Display, Barlow.
- Da Instagram si prendono solo identità visiva e foto, mai numeri.

## 10. Aggiornamento ottobre 2026 — Livescore CSI

Con l'accesso al sito (`livescore.csibologna.it`) lo script `npm run livescore:sync` scarica,
per le competizioni configurate in `data/curated/competitions.json`, calendario, risultati,
parziali, orari, palestre (con indirizzo) e classifiche ufficiali.

- **Verifica degli screenshot**: le 18 partite trascritte dagli screenshot e la classifica
  2023-24 del PDF coincidono al 100% con il sito.
- **61 partite storiche trovate tutte** sul Livescore: ora hanno ID CSI, codice gara, giornata,
  orario, palestra e parziali (488 parziali; gli export HTML non li contengono).
- **Playoff 2023-24**: due competizioni CSI, Play-Off Top Silver 1° turno (486) e Play-Off Top
  Silver (501). Avversari confermati: PGS Bellaria - Tecno Bar Cerè (8 e 16/04/2024) e Fagian's
  (23 e 29/04/2024).
- **Avversari corretti** (l'associazione soprannome → squadra dell'Excel era sbagliata, vale il
  CSI): 21/10/2025 Fagian's (non HD Bologna), 04/11/2025 Ghepard 2003 (non Fagian's), 06/02/2026
  Ghepard 2003 (non Valsamoggia), 12/02/2026 Valsamoggia Academy (non Porretta: risolve il caso #7).
  Anche 29/11/2024 (Bolo State Neptunes) e 02/12/2024 (Diablos) sono confermati.
- **Casa/trasferta Libertas San Felice**: 05/12/2025 in casa Sgreeners, 06/03/2026 in casa
  Libertas (l'Excel segnava entrambe in casa).
- **Felsinea, 6ª gara della Poule 2024-25**: 10/03/2025, in casa, 63-54 (come dedotto dai totali).
- **Classifiche ufficiali**: 2024-25 Silver A (2° posto, a pari punti con Golden Stalla
  Warriors: decide lo scontro diretto, non il quoziente) e Poule Super Silver B (1°); 2025-26
  Silver girone A (2°); 2026-27 Silver girone A.
- **Stagione 2026-27**: squadra CSI 3792, PCA Silver girone A, 18 gare (3 con data, le altre da
  fissare).
- **Identità delle squadre**: le corrispondenze tra stagioni sono verificate sulla società CSI
  (es. "Diablos Silver" 2026-27 = Diablos Basket; "Energym Savena Bridge" è il nome ufficiale
  della squadra che l'Excel chiamava "Impro Savena Bridge - CMB"; "PGS Igea" = PGS Bellaria).
- **Formazioni del Livescore non usate**: in 12 partite su 51 con tabellino la somma dei punti
  dei giocatori non coincide con il risultato e spesso differisce dai box score; in 10 manca.
  Le statistiche individuali restano quelle di HTML/Excel.
- **Punteggi box score ≠ CSI**: oltre al caso #1, 31/10/2025 (HTML 67-45, CSI 67-46) e
  21/05/2025 (HTML 73-58, CSI 73-59, che spiega il caso #4). Vale il CSI; registrati come conflitti.
- **Risultati non omologati**: 10 partite risultano ancora "non omologate" (in corsivo) sul sito.

## 11. Informazioni fornite dalla squadra (ottobre 2026)

Dati curati a mano in `data/curated/`, caricati dall'import storico con fonte *Informazioni
fornite dalla squadra*:

- **Numero di maglia principale** (`roster.json`): il sito mostra sempre questo; chi ha giocato
  con maglie prestate (es. Davide Nanni con la #69 nel 2024-25) conserva il numero indossato nelle
  righe partita.
- **Staff per stagione** (`staff.json`): allenatore, vice allenatore, dirigente accompagnatore,
  statistiche; chi è anche giocatore è collegato alla sua scheda. Si gestisce anche da
  *Admin → Staff*.
- **Discrepanze verificate** (`manual-conflicts.json`): le discrepanze della sezione 8 rimaste
  aperte (avversari, casa/trasferta, data, punteggi, punti non attribuiti, presenze) sono state
  confermate a favore della fonte primaria; l'import le chiude con una nota (19 voci in
  `resolved`). L'unica discrepanza non rilevabile in automatico, la data del 13/03/2026 (foto
  14/03 vs CSI 13/03), è dichiarata in `conflicts` e chiusa allo stesso modo.
- Capitano, vice capitano, ruoli, MVP di partita, date di nascita, allenamenti e pause si
  inseriscono dall'admin.
