/**
 * Analizza tutti i box score HTML in una cartella con la pipeline di import
 * (estrazione + normalizzazione + validazione) e stampa un riepilogo.
 * Uso: npm run check:html -- data/sources/02_HTML_PARTITE
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMatchHtml, validateImportedMatch } from "../src/lib/importers";

const dir = process.argv[2] ?? "data/sources/02_HTML_PARTITE";
const ownTeamNames = (process.env.OWN_TEAM_NAMES ?? "Sgreeners").split(",");
const seen = new Map<string, string>();

for (const file of readdirSync(dir).filter((f) => f.endsWith(".html")).sort()) {
  const content = readFileSync(join(dir, file), "utf8");
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
  if (seen.has(hash)) {
    console.log(`DUPLICATO  ${file}  (identico a ${seen.get(hash)})`);
    continue;
  }
  seen.set(hash, file);
  try {
    const r = parseMatchHtml(content, { ownTeamNames });
    const issues = validateImportedMatch(r);
    const played = r.players.filter((p) => p.didPlay).length;
    console.log(
      [r.date, r.formatVariant.padEnd(13), `${r.own.score}-${r.opponent.score}`.padEnd(7),
        `gioc ${played}/${r.players.length}`, `per ${r.periods.length}`, `tiri ${r.shots.own.length}`,
        hash, file.slice(0, 50)].join("  "),
    );
    for (const i of issues) console.log(`     ${i.level.toUpperCase()} ${i.code}: ${i.message}${i.ref ? ` [${i.ref}]` : ""}`);
  } catch (e) {
    console.log(`ERRORE ${file}: ${(e as Error).message}`);
  }
}
