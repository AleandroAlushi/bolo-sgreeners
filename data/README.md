# Dati

- `curated/` — dati strutturati **curati a mano** (committati): trascrizioni degli screenshot e
  dei PDF del Livescore CSI, identità delle squadre, struttura delle stagioni, discrepanze note.
  Ogni file indica nel campo `$comment` da quale fonte deriva. `livescore.json` è l'eccezione:
  è generato da `npm run livescore:sync` e non va modificato a mano. I file `calendar-*.json`
  trascrivono il calendario della squadra (es. un `.ics`): completano data, orario, palestra e
  giornata delle gare che il CSI non ha ancora pubblicato; dove il CSI le pubblica vale il CSI e le
  differenze diventano discrepanze.
- `sources/` — **fonti originali** (NON committate, in `.gitignore`): copiare qui il contenuto
  del pacchetto fonti (cartelle `01_EXCEL`, `02_HTML_PARTITE`, ...) prima di lanciare
  `npm run import:historical`.
- `build/` — output degli script (dataset intermedio, report). Generato, non committato.
