/**
 * Video in loop di una stagione (al posto della foto nella figurina): prepara il video e lo carica.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/video-loop/carica.ts [--staff] <slug> <video.mov> [stagione] [opzioni]
 *
 * Opzioni:
 *   --da=1.5      secondo da cui partire (predefinito 0)
 *   --durata=3    quanti secondi tenere (predefinito: tutto)
 *   --alto=0.6    dove tagliare in verticale, da 0 (in alto) a 1 (in basso); predefinito 0.6
 *   --prova       prepara solo i file in data/private/gif/out/, senza caricare niente
 *   --pronto      il video è già pronto (720×900, per esempio con il numero di maglia cambiato):
 *                 si carica così com'è, senza rifarlo
 *   --copertina=3.5  secondo del fotogramma da usare come copertina (predefinito 0)
 *
 * Il video diventa 720×900 (4:5, come la figurina), senza audio, H.264 pronto per il web, con la
 * copertina accanto (stesso nome, .jpg). Stagione predefinita 2026-27. Serve ffmpeg (o FFMPEG con
 * il percorso) e, per caricare, SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const staff = args.includes("--staff");
const dry = args.includes("--prova");
const ready = args.includes("--pronto");
const coverAt = flag("copertina") ?? "0";
const [slug, file, seasonSlug = "2026-27"] = args.filter((a) => !a.startsWith("--"));
const from = Number(flag("da") ?? 0);
const duration = flag("durata");
const top = Number(flag("alto") ?? 0.6);
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const OUT = "data/private/gif/out";

(async () => {
  if (!slug || !file) throw new Error("Uso: carica.ts [--staff] <slug> <video> [stagione] [--da=s] [--durata=s] [--alto=0..1] [--prova]");
  if (!(top >= 0 && top <= 1)) throw new Error("--alto va da 0 a 1");
  mkdirSync(OUT, { recursive: true });
  const mp4 = ready ? file : `${OUT}/${slug}.mp4`;
  const jpg = `${OUT}/${slug}.jpg`;
  // ritaglio 4:5 al centro in orizzontale; in verticale secondo --alto
  const crop = `crop='min(iw,ih*4/5)':'min(ih,iw*5/4)':'(iw-ow)/2':'(ih-oh)*${top}'`;
  const trim = ["-ss", String(from), ...(duration ? ["-t", duration] : [])];
  if (!ready) execFileSync(FFMPEG, ["-v", "error", "-y", ...trim, "-i", file, "-an", "-vf", `${crop},fps=30,scale=720:900:flags=lanczos,format=yuv420p`,
    "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-movflags", "+faststart", mp4], { stdio: "inherit" });
  execFileSync(FFMPEG, ["-v", "error", "-y", "-ss", coverAt, "-i", mp4, "-frames:v", "1", "-q:v", "3", jpg], { stdio: "inherit" });
  const kb = Math.round(statSync(mp4).size / 1024);
  console.log(`Pronti ${mp4} (${kb} KB) e ${jpg}`);
  if (kb > 4800) throw new Error("Video troppo pesante per lo storage (massimo 5 MB): accorcialo con --durata");
  if (dry) return console.log("Prova: niente caricato.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: season } = await db.from("seasons").select("id").eq("slug", seasonSlug).single();
  const person = staff
    ? (await db.from("staff_members").select("id").eq("slug", slug).single()).data
    : (await db.from("players").select("id").eq("slug", slug).single()).data;
  if (!season || !person) throw new Error(`Stagione ${seasonSlug} o ${staff ? "membro dello staff" : "giocatore"} ${slug} non trovati`);
  const base = `${staff ? "staff" : "players"}/${seasonSlug}/${slug}-video-${Date.now()}`;
  for (const [path, body, contentType] of [[`${base}.jpg`, readFileSync(jpg), "image/jpeg"], [`${base}.mp4`, readFileSync(mp4), "video/mp4"]] as const) {
    const up = await db.storage.from("media").upload(path, body, { contentType });
    if (up.error) throw up.error;
  }
  const { data, error } = staff
    ? await db.from("season_staff").update({ video_path: `${base}.mp4` }).eq("season_id", season.id).eq("staff_id", person.id).select("staff_id")
    : await db.from("season_rosters").update({ video_path: `${base}.mp4` }).eq("season_id", season.id).eq("player_id", person.id).select("player_id");
  if (error) throw error;
  if (!data?.length) throw new Error(`${slug} non è ${staff ? "nello staff" : "nel roster"} ${seasonSlug}`);
  console.log(`Video ${seasonSlug} di ${slug} caricato: ${base}.mp4 (il sito lo mostra entro un'ora, o subito salvando un giocatore in Admin)`);
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
