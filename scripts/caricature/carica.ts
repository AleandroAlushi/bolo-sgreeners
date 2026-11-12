/**
 * Carica una figurina (900×1125) come foto di un giocatore in una stagione, sul sito vero.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/caricature/carica.ts <slug-giocatore> <figurina.jpg> [stagione]
 *   npx tsx --env-file-if-exists=.env.local scripts/caricature/carica.ts --staff <slug-staff> <figurina.jpg> [stagione]
 *
 * Esempio: ... carica.ts luca-biolchini data/private/caricature/card/luca-biolchini-figurina.jpg 2026-27
 * Serve SUPABASE_SERVICE_ROLE_KEY in .env.local. Il sito mostra la foto nuova entro un'ora
 * (o subito salvando un giocatore qualsiasi in Admin).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const staff = process.argv.includes("--staff");
const [slug, file, seasonSlug = "2026-27"] = process.argv.slice(2).filter((a) => a !== "--staff");

(async () => {
  if (!slug || !file) throw new Error("Uso: carica.ts <slug-giocatore> <figurina.jpg> [stagione]");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: season } = await db.from("seasons").select("id").eq("slug", seasonSlug).single();
  const person = staff
    ? (await db.from("staff_members").select("id").eq("slug", slug).single()).data
    : (await db.from("players").select("id").eq("slug", slug).single()).data;
  if (!season || !person) throw new Error(`Stagione ${seasonSlug} o ${staff ? "membro dello staff" : "giocatore"} ${slug} non trovati`);
  const path = `${staff ? "staff" : "players"}/${seasonSlug}/${slug}-${Date.now()}.jpg`;
  const up = await db.storage.from("media").upload(path, readFileSync(file), { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  // giocatori: il ritaglio del viso del tondino va ricalcolato (npm run photos:avatar)
  const { data, error } = staff
    ? await db.from("season_staff").update({ photo_path: path }).eq("season_id", season.id).eq("staff_id", person.id).select("staff_id")
    : await db.from("season_rosters").update({ photo_path: path, avatar_crop: null }).eq("season_id", season.id).eq("player_id", person.id).select("player_id");
  if (error) throw error;
  if (!data?.length) throw new Error(`${slug} non è ${staff ? "nello staff" : "nel roster"} ${seasonSlug}`);
  console.log(`Foto ${seasonSlug} di ${slug} aggiornata: ${path}`);
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
