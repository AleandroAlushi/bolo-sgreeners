/**
 * Foto di una stagione (figurine della pagina Squadra) da una cartella: ogni file viene abbinato a
 * un giocatore del roster o a un membro dello staff di quella stagione dal nome del file,
 * ritagliato 4:5 come la figurina (900×1125 JPG, vedi src/lib/figurina.ts) e caricato nel bucket "media".
 *
 *   npm run photos:import -- --season=2023-24 --dir="/percorso/foto 2023-24" --dry-run
 *   npm run photos:import -- --season=2023-24 --dir="/percorso/foto 2023-24"
 *   npm run photos:import -- --season=2023-24 --dir=... --update   # sostituisce anche le foto già caricate
 *
 * Nomi dei file: nome e cognome in qualsiasi ordine ("Federico Hrvatin.jpg", "hrvatin_federico.png"),
 * il solo cognome se nella stagione non è ambiguo, oppure il soprannome ("Chicco.jpg").
 * Variabili: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { toFigurina } from "../../src/lib/figurina";
import { client } from "../import-historical/persist";
import { revalidateSite } from "../livescore/revalidate";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const season = arg("season");
const dir = arg("dir");
const dryRun = process.argv.includes("--dry-run");
const update = process.argv.includes("--update");
const IMAGES = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

/** "Fédérico_HRVATIN (1)" → ["federico", "hrvatin"] */
const words = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !/^\d+$/.test(w));

interface Person {
  kind: "player" | "staff";
  id: string;
  slug: string;
  name: string;
  first: string[];
  last: string[];
  nickname: string[];
  hasPhoto: boolean;
}

export function matchPerson(fileName: string, people: Person[]): { person: Person | null; reason: string } {
  const w = new Set(words(fileName));
  const has = (parts: string[]) => parts.length > 0 && parts.every((p) => w.has(p));
  const full = people.filter((p) => has(p.first) && has(p.last));
  if (full.length === 1) return { person: full[0], reason: "nome e cognome" };
  if (full.length > 1) return { person: null, reason: `ambiguo: ${full.map((p) => p.name).join(", ")}` };
  const byLast = people.filter((p) => has(p.last));
  if (byLast.length === 1) return { person: byLast[0], reason: "cognome" };
  const byNick = people.filter((p) => has(p.nickname));
  if (byNick.length === 1) return { person: byNick[0], reason: "soprannome" };
  const many = [...byLast, ...byNick];
  return { person: null, reason: many.length ? `ambiguo: ${[...new Set(many.map((p) => p.name))].join(", ")}` : "nessuno con questo nome" };
}

async function main() {
  if (!season || !dir) throw new Error('Uso: npm run photos:import -- --season=2023-24 --dir="/percorso/cartella" [--dry-run] [--update]');
  const db = client();
  const { data: seasonRow } = await db.from("seasons").select("id, slug").eq("slug", season).maybeSingle();
  if (!seasonRow) throw new Error(`Stagione ${season} non trovata`);
  const [roster, staff] = await Promise.all([
    db.from("season_rosters").select("player_id, photo_path, players(slug, first_name, last_name, nickname)").eq("season_id", seasonRow.id),
    db.from("season_staff").select("staff_id, photo_path, staff_members(slug, first_name, last_name, player_id)").eq("season_id", seasonRow.id),
  ]);
  if (roster.error || staff.error) throw new Error((roster.error ?? staff.error)!.message);
  const people: Person[] = [];
  for (const r of roster.data) {
    const p = r.players!;
    people.push({ kind: "player", id: r.player_id, slug: p.slug, name: `${p.first_name} ${p.last_name}`, first: words(p.first_name), last: words(p.last_name), nickname: words(p.nickname ?? ""), hasPhoto: Boolean(r.photo_path) });
  }
  for (const s of staff.data) {
    const m = s.staff_members!;
    // chi è staff e anche giocatore della stagione ha già la sua riga: la foto vale per entrambe
    if (m.player_id && roster.data.some((r) => r.player_id === m.player_id)) continue;
    if (people.some((p) => p.kind === "staff" && p.id === s.staff_id)) continue;
    people.push({ kind: "staff", id: s.staff_id, slug: m.slug, name: `${m.first_name} ${m.last_name}`, first: words(m.first_name), last: words(m.last_name), nickname: [], hasPhoto: Boolean(s.photo_path) });
  }

  const files = readdirSync(dir).filter((f) => IMAGES.has(extname(f).toLowerCase()) && !f.startsWith("."));
  console.log(`Stagione ${season}: ${files.length} foto, ${people.length} persone tra roster e staff${dryRun ? " (prova, nessuna scrittura)" : ""}\n`);
  const used = new Map<string, string>();
  let uploaded = 0;
  for (const f of files.sort()) {
    const { person, reason } = matchPerson(f.replace(extname(f), ""), people);
    if (!person) {
      console.log(`✗ ${f}: ${reason}`);
      continue;
    }
    if (used.has(person.id)) {
      console.log(`✗ ${f}: ${person.name} ha già una foto in questa cartella (${used.get(person.id)})`);
      continue;
    }
    used.set(person.id, f);
    if (person.hasPhoto && !update) {
      console.log(`= ${f} → ${person.name}: ha già una foto della stagione (usa --update per sostituirla)`);
      continue;
    }
    if (dryRun) {
      console.log(`✓ ${f} → ${person.name} (${reason})`);
      continue;
    }
    let body: Buffer;
    try {
      body = await toFigurina(readFileSync(join(dir, f)));
    } catch (e) {
      console.log(`✗ ${f}: immagine non leggibile (${(e as Error).message}). Le foto HEIC dell'iPhone vanno prima esportate in JPG.`);
      continue;
    }
    const path = `${person.kind === "player" ? "players" : "staff"}/${season}/${person.slug}-${createHash("sha1").update(body).digest("hex").slice(0, 8)}.jpg`;
    const up = await db.storage.from("media").upload(path, body, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error(`Storage ${f}: ${up.error.message}`);
    const res =
      person.kind === "player"
        ? await db.from("season_rosters").update({ photo_path: path }).eq("season_id", seasonRow.id).eq("player_id", person.id)
        : await db.from("season_staff").update({ photo_path: path }).eq("season_id", seasonRow.id).eq("staff_id", person.id);
    if (res.error) throw new Error(`${person.name}: ${res.error.message}`);
    // staff che gioca: la stessa foto anche nella scheda staff della stagione
    if (person.kind === "player") {
      await db.from("season_staff").update({ photo_path: path }).eq("season_id", seasonRow.id).in("staff_id", staff.data.filter((s) => s.staff_members?.player_id === person.id).map((s) => s.staff_id));
    }
    console.log(`✓ ${f} → ${person.name} (${Math.round(body.length / 1024)} KB)`);
    uploaded++;
  }
  const missing = people.filter((p) => !used.has(p.id) && !p.hasPhoto);
  if (missing.length) console.log(`\nSenza foto in ${season}: ${missing.map((p) => p.name).join(", ")}`);
  console.log(dryRun ? "\nProva finita." : `\nFoto caricate: ${uploaded}.`);
  if (!dryRun && uploaded > 0) await revalidateSite();
}

if (process.argv[1]?.endsWith("import.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
