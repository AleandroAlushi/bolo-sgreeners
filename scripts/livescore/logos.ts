/**
 * Loghi delle squadre avversarie dal Livescore CSI Bologna: li legge dalle classifiche di tutte
 * le competizioni configurate (la stagione più recente vince), li carica nel bucket "media" di
 * Supabase Storage e li collega alle squadre (teams.logo_path). Usati da sito e grafiche.
 *
 *   npm run livescore:logos -- --dry-run   # elenca i loghi trovati, senza scaricare né scrivere
 *   npm run livescore:logos                # carica i loghi delle squadre che non ne hanno uno
 *   npm run livescore:logos -- --update    # sostituisce anche quelli già presenti
 *
 * Variabili: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Un logo uguale per più squadre è un segnaposto del Livescore e viene ignorato.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeTeamName } from "../../src/lib/importers/normalize";
import { client } from "../import-historical/persist";
import { projectLogos, type Config } from "./fetch";
import { revalidateSite } from "./revalidate";

const CURATED = join(process.cwd(), "data", "curated");
const dryRun = process.argv.includes("--dry-run");
const update = process.argv.includes("--update");
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

async function main() {
  const cfg = JSON.parse(readFileSync(join(CURATED, "competitions.json"), "utf8")) as Config & { ownTeam: { slug: string } };
  const teamsCfg = JSON.parse(readFileSync(join(CURATED, "teams.json"), "utf8")) as { teams: { slug: string; officialNames: string[] }[] };
  const officialToTeam = new Map<string, string>();
  for (const t of teamsCfg.teams) for (const n of t.officialNames) officialToTeam.set(normalizeTeamName(n), t.slug);
  const ownNames = new Set([cfg.ownTeam.name, ...cfg.seasons.map((s) => s.ownDisplayName)].filter((n): n is string => !!n).map(normalizeTeamName));

  // dalla stagione più recente: il logo attuale prevale su quelli vecchi
  const found = new Map<string, { url: string; official: string; season: string }>();
  const usedBy = new Map<string, Set<string>>();
  const unknown = new Set<string>();
  for (const season of [...cfg.seasons].sort((a, b) => b.slug.localeCompare(a.slug))) {
    if (!season.csiTeamId) continue;
    for (const c of season.competitions) {
      if (!c.csi_project_id) continue;
      for (const row of await projectLogos(c.csi_project_id, season.csiTeamId)) {
        const key = normalizeTeamName(row.team);
        if (ownNames.has(key)) continue; // il nostro logo resta quello del sito
        const slug = officialToTeam.get(key);
        if (!slug) {
          unknown.add(row.team);
          continue;
        }
        if (!usedBy.has(row.logoUrl)) usedBy.set(row.logoUrl, new Set());
        usedBy.get(row.logoUrl)!.add(slug);
        if (!found.has(slug)) found.set(slug, { url: row.logoUrl, official: row.team, season: season.slug });
      }
    }
  }
  // avversari incontrati solo in poule o playoff (senza classifica): si cercano negli altri gironi
  const missing = teamsCfg.teams.filter((t) => !found.has(t.slug));
  if (missing.length > 0) {
    for (const season of [...cfg.seasons].sort((a, b) => b.slug.localeCompare(a.slug))) {
      for (const c of season.competitions) {
        if (!c.csi_project_id) continue;
        for (const row of await projectLogos(c.csi_project_id, null)) {
          const slug = officialToTeam.get(normalizeTeamName(row.team));
          if (!slug || found.has(slug) || !missing.some((t) => t.slug === slug)) continue;
          found.set(slug, { url: row.logoUrl, official: row.team, season: season.slug });
          if (!usedBy.has(row.logoUrl)) usedBy.set(row.logoUrl, new Set());
          usedBy.get(row.logoUrl)!.add(slug);
        }
      }
    }
  }
  for (const t of teamsCfg.teams) if (!found.has(t.slug)) console.log(`Nessun logo sul Livescore per ${t.slug}`);

  // stesso file per squadre diverse = segnaposto
  for (const [slug, f] of found) {
    if ((usedBy.get(f.url)?.size ?? 0) > 1) {
      console.log(`Segnaposto ignorato per ${slug}: ${f.url}`);
      found.delete(slug);
    }
  }

  const db = client();
  const { data: teams, error } = await db.from("teams").select("id, slug, logo_path");
  if (error) throw new Error(`Squadre: ${error.message}`);
  let uploaded = 0;
  for (const [slug, f] of [...found].sort()) {
    const team = teams.find((t) => t.slug === slug);
    if (!team) {
      console.log(`- ${slug}: squadra non presente nel database (lancia l'import storico)`);
      continue;
    }
    if (team.logo_path && !update) {
      console.log(`- ${slug}: logo già presente, lasciato com'è`);
      continue;
    }
    if (dryRun) {
      console.log(`- ${slug} (${f.official}, ${f.season}): ${f.url}`);
      continue;
    }
    const res = await fetch(f.url, { headers: { "User-Agent": "archivio-bolo-sgreeners" } });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !EXT[type]) {
      console.log(`- ${slug}: download non riuscito (${res.status} ${type})`);
      continue;
    }
    const body = Buffer.from(await res.arrayBuffer());
    const path = `teams/${slug}-${createHash("sha1").update(body).digest("hex").slice(0, 8)}.${EXT[type]}`;
    const up = await db.storage.from("media").upload(path, body, { contentType: type, upsert: true });
    if (up.error) throw new Error(`Storage ${slug}: ${up.error.message}`);
    const { error: e } = await db.from("teams").update({ logo_path: path }).eq("id", team.id);
    if (e) throw new Error(`Squadra ${slug}: ${e.message}`);
    console.log(`- ${slug}: caricato ${path} (${Math.round(body.length / 1024)} KB)`);
    uploaded++;
    await new Promise((r) => setTimeout(r, 300)); // gentilezza verso il server CSI
  }
  for (const u of unknown) console.log(`ATTENZIONE squadra del Livescore non in teams.json (logo non usato): ${u}`);
  console.log(dryRun ? `\nProva: ${found.size} loghi trovati, nessuna scrittura.` : `\nLoghi caricati: ${uploaded}.`);
  if (!dryRun && uploaded > 0) await revalidateSite();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
