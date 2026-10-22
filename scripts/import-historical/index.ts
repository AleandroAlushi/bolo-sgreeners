/**
 * Import storico Bolo Sgreeners: Excel + box score HTML + dati CSI curati → Supabase.
 *
 *   npm run import:historical -- --dry-run            # costruisce e valida, non scrive
 *   npm run import:historical                         # scrive su Supabase (service role)
 *   npm run import:historical -- --no-storage         # non carica gli HTML su Storage
 *   npm run import:historical -- --update             # aggiorna anche le righe già presenti
 *
 * Variabili: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Le fonti vanno messe in data/sources (vedi README). Rieseguirlo non duplica nulla.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDataset } from "./build";
import { persistDataset } from "./persist";

const args = new Set(process.argv.slice(2));
const sourcesArg = process.argv.find((a) => a.startsWith("--sources="));
const sourcesDir = sourcesArg ? sourcesArg.split("=")[1] : join(process.cwd(), "data", "sources");

async function main() {
  console.log(`Fonti: ${sourcesDir}`);
  const ds = await buildDataset(sourcesDir);
  const summary = {
    stagioni: ds.seasons.length,
    competizioni: ds.competitions.length,
    squadre: ds.teams.length,
    giocatori: ds.players.length,
    alias_giocatori: ds.playerAliases.length,
    partite: ds.matches.length,
    parziali: ds.periods.length,
    import_statistiche: ds.statImports.length,
    righe_roster: ds.rosters.length,
    conflitti_rilevati: ds.conflicts.length + ds.statImports.reduce((a, s) => a + s.conflicts.length, 0),
  };
  console.table(summary);
  for (const l of ds.log) console.log(l);

  mkdirSync(join(process.cwd(), "data", "build"), { recursive: true });
  const outPath = join(process.cwd(), "data", "build", "historical-dataset.json");
  const forDisk = { ...ds, statImports: ds.statImports.map((s) => ({ ...s, content: null })) };
  writeFileSync(outPath, JSON.stringify(forDisk, null, 1));
  console.log(`Dataset scritto in ${outPath}`);

  if (args.has("--dry-run")) {
    console.log("Dry run: nessuna scrittura sul database.");
    return;
  }
  await persistDataset(ds, { uploadFiles: !args.has("--no-storage"), update: args.has("--update") });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
