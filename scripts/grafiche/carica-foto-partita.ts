/**
 * Carica foto in partita già scontornate (PNG trasparenti) nella galleria delle grafiche:
 * media/foto-partita/<slug-giocatore>/<nome>.png. In Admin → Grafiche, nella presentazione della
 * partita, si scelgono dalla galleria divisa per giocatore.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/grafiche/carica-foto-partita.ts <slug-giocatore> <foto.png> [altre.png…]
 *
 * Serve SUPABASE_SERVICE_ROLE_KEY in .env.local. Lo scontorno si prepara prima (vedi NOTE.md).
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

const [slug, ...files] = process.argv.slice(2);

(async () => {
  if (!slug || files.length === 0) throw new Error("Uso: carica-foto-partita.ts <slug-giocatore> <foto.png> [altre.png…]");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: player } = await db.from("players").select("id").eq("slug", slug).maybeSingle();
  if (!player) throw new Error(`Giocatore ${slug} non trovato`);
  for (const file of files) {
    if (!/\.png$/i.test(file)) throw new Error(`${file}: serve un PNG scontornato`);
    const name = `${Date.now()}-${basename(file).toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`;
    const path = `foto-partita/${slug}/${name}`;
    const { error } = await db.storage.from("media").upload(path, readFileSync(file), { contentType: "image/png" });
    if (error) throw error;
    console.log(`Caricata: ${path}`);
  }
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
