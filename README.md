# Bolo Sgreeners

Web app e archivio digitale dei **Bolo Sgreeners**, squadra di basket CSI di Bologna: stagioni,
roster, partite con box score, calendari, classifiche, statistiche, statistiche live a bordo
campo e grafiche per Instagram. Responsive e installabile sul telefono come app (PWA).

**Sito:** https://bolo-sgreeners.vercel.app

## Documentazione

| Documento | Cosa trovi |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | come si lavora sul progetto: rami, PR, database di prova in locale |
| [docs/FUNZIONALITA.md](docs/FUNZIONALITA.md) | cosa fa il sito, pagina per pagina, e l'area admin |
| [docs/GESTIONE.md](docs/GESTIONE.md) | Supabase, Vercel, variabili d'ambiente, import dei dati, Livescore CSI |
| [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md) | schema del database, scelte tecniche, elenco delle pagine |
| [docs/DATI_IDENTIFICATI.md](docs/DATI_IDENTIFICATI.md) | report sulle fonti storiche analizzate |

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (PostgreSQL, Auth, Storage) · zod · vitest · Vercel.

## Avvio rapido

Requisiti: Node.js ≥ 20.9.

```bash
npm install
cp .env.example .env.local   # compila le variabili (vedi docs/GESTIONE.md)
npm run dev                  # http://localhost:3000
```

Senza Supabase configurato l'app parte comunque e mostra stati vuoti. Per lavorare con dati veri
senza toccare la produzione usa il database di prova in locale descritto in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Comandi principali

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` / `build` / `start` | sviluppo, build di produzione, avvio |
| `npm run check` | typecheck + lint + test: da lanciare prima di ogni PR |
| `npm run test` | solo i test vitest |
| `npm run db:types` | rigenera i tipi TypeScript dal database collegato |
| `npm run db:local:reset` / `db:local:stack` | database di prova in locale, senza Docker |

Gli altri comandi (import, Livescore, foto, notifiche) sono spiegati in
[docs/GESTIONE.md](docs/GESTIONE.md) e [docs/FUNZIONALITA.md](docs/FUNZIONALITA.md).

## Struttura

```
src/app/(site)/          pagine pubbliche
src/app/admin/           area admin (login + pagine protette)
src/app/grafiche/        grafiche PNG per Instagram
src/components/          componenti UI
src/lib/data/            letture dal database (con cache)
src/lib/domain/          logica pura: statistiche, classifica, formattazione
src/lib/importers/       parser dei box score
src/lib/supabase/        client Supabase e tipi generati
supabase/migrations/     migration SQL versionate (partono da sole al merge su main)
scripts/                 import storico, Livescore, foto, database locale
data/curated/            dati curati a mano (committati)
data/private/, data/sources/   dati riservati e fonti originali (NON su GitHub)
tests/                   test vitest con fixture sintetiche
```
