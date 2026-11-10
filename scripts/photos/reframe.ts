/**
 * Ritocca l'inquadratura delle figurine già caricate (giocatori e staff), senza la foto originale:
 *   npx tsx --env-file-if-exists=.env.local scripts/photos/reframe.ts <regole.json> [--prova <cartella>]
 *
 * regole.json: [{ "path": "players/2025-26/x.jpg", "zoom": 0.86, "x": 0.5, "y": 1 }]
 * - zoom > 1 ingrandisce (ritaglio attorno al punto x,y, frazioni di larghezza e altezza);
 * - zoom < 1 rimpicciolisce: la foto si appoggia nel punto x,y (0 = sinistra/alto, 1 = destra/basso)
 *   e il resto del riquadro si riempie allungando i bordi della foto ("bordi", adatto agli sfondi
 *   in tinta unita) oppure con la stessa foto sfocata ("sfocata").
 * Con --prova scrive solo le anteprime; altrimenti carica le nuove foto e aggiorna roster e staff.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { FIGURINA } from "../../src/lib/figurina";
import { revalidateSite } from "../livescore/revalidate";

interface Rule {
  path: string;
  zoom: number;
  x?: number;
  y?: number;
  fill?: "bordi" | "sfocata";
}

const { width: W, height: H } = FIGURINA;

export async function reframe(input: Buffer, rule: Rule): Promise<Buffer> {
  const x = rule.x ?? 0.5;
  const y = rule.y ?? 0.5;
  const base = await sharp(input).resize(W, H, { fit: "cover" }).toBuffer();
  if (rule.zoom >= 1) {
    const cw = Math.round(W / rule.zoom);
    const ch = Math.round(H / rule.zoom);
    const left = Math.min(W - cw, Math.max(0, Math.round(x * W - cw / 2)));
    const top = Math.min(H - ch, Math.max(0, Math.round(y * H - ch / 2)));
    return sharp(base).extract({ left, top, width: cw, height: ch }).resize(W, H).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  }
  const sw = Math.round(W * rule.zoom);
  const sh = Math.round(H * rule.zoom);
  const small = await sharp(base).resize(sw, sh).toBuffer();
  const left = Math.round((W - sw) * x);
  const top = Math.round((H - sh) * y);
  if ((rule.fill ?? "bordi") === "bordi") {
    return sharp(small)
      .extend({ top, bottom: H - sh - top, left, right: W - sw - left, extendWith: "copy" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
  }
  const fill = await sharp(base).blur(28).toBuffer();
  return sharp(fill).composite([{ input: small, left, top }]).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}

async function main() {
  const [rulesFile, flag, outDir] = process.argv.slice(2);
  if (!rulesFile) throw new Error("Uso: reframe.ts <regole.json> [--prova <cartella>]");
  const rules: Rule[] = JSON.parse(readFileSync(rulesFile, "utf8"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Manca NEXT_PUBLIC_SUPABASE_URL");
  const dry = flag === "--prova";
  if (dry) mkdirSync(outDir ?? "reframe-prova", { recursive: true });
  const db = !dry && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  if (!dry && !db) throw new Error("Manca SUPABASE_SERVICE_ROLE_KEY");

  for (const rule of rules) {
    const res = await fetch(`${url}/storage/v1/object/public/media/${rule.path}`);
    if (!res.ok) throw new Error(`${rule.path}: ${res.status}`);
    const out = await reframe(Buffer.from(await res.arrayBuffer()), rule);
    if (dry) {
      writeFileSync(join(outDir ?? "reframe-prova", rule.path.replace(/\//g, "_")), out);
      console.log(`anteprima ${rule.path}`);
      continue;
    }
    const next = rule.path.replace(/-\d+\.jpg$/, "") + `-${Date.now()}.jpg`;
    const up = await db!.storage.from("media").upload(next, out, { contentType: "image/jpeg" });
    if (up.error) throw new Error(`${rule.path}: ${up.error.message}`);
    const table = rule.path.startsWith("staff/") ? "season_staff" : "season_rosters";
    const { data, error } = await db!.from(table).update({ photo_path: next }).eq("photo_path", rule.path).select("photo_path");
    if (error) throw new Error(`${rule.path}: ${error.message}`);
    console.log(`${rule.path} → ${next} (${data?.length ?? 0} righe)`);
  }
  if (!dry) await revalidateSite();
}

if (process.argv[1]?.endsWith("reframe.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
