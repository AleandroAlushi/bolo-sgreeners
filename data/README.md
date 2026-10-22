# Dati

- `curated/` — dati strutturati **curati a mano** (committati): trascrizioni degli screenshot e
  dei PDF del Livescore CSI, identità delle squadre, struttura delle stagioni, discrepanze note.
  Ogni file indica nel campo `$comment` da quale fonte deriva.
- `sources/` — **fonti originali** (NON committate, in `.gitignore`): copiare qui il contenuto
  del pacchetto fonti (cartelle `01_EXCEL`, `02_HTML_PARTITE`, ...) prima di lanciare
  `npm run import:historical`.
- `build/` — output degli script (dataset intermedio, report). Generato, non committato.
