/**
 * Scarica dal Livescore CSI Bologna calendario, risultati, parziali, palestre e classifiche
 * ufficiali delle stagioni configurate in data/curated/competitions.json e li scrive in
 * data/curated/livescore.json (poi usato da `npm run import:historical`).
 *
 *   npm run livescore:sync                 # scarica tutto
 *   npm run livescore:sync -- --cache      # riusa le pagine già scaricate (data/build/livescore-cache)
 *
 * Per aggiornare solo la stagione in corso direttamente sul database: `npm run livescore:update`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchLivescore, type Config } from "./fetch";

const CURATED = join(process.cwd(), "data", "curated");

async function main() {
  const cfg = JSON.parse(readFileSync(join(CURATED, "competitions.json"), "utf8")) as Config;
  const { warnings, ...data } = await fetchLivescore(cfg, { cache: process.argv.includes("--cache") });
  const out = {
    $comment:
      "Generato da `npm run livescore:sync` (scripts/livescore/sync.ts): calendario, risultati, parziali, palestre e classifiche dal Livescore CSI Bologna. Non modificare a mano: correggere i dati in competitions.json/teams.json e rilanciare lo script.",
    ...data,
  };
  writeFileSync(join(CURATED, "livescore.json"), JSON.stringify(out, null, 1) + "\n");

  console.table(
    Object.entries(
      data.matches.reduce<Record<string, { partite: number; giocate: number }>>((acc, m) => {
        const k = `${m.season} ${m.competition}`;
        acc[k] ??= { partite: 0, giocate: 0 };
        acc[k].partite++;
        if (m.homeScore !== null) acc[k].giocate++;
        return acc;
      }, {}),
    ).map(([k, v]) => ({ competizione: k, ...v })),
  );
  console.log(`Classifiche: ${data.standings.length}. Palestre: ${data.venues.length}. Scritto data/curated/livescore.json`);
  for (const w of warnings) console.log(`ATTENZIONE ${w}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
