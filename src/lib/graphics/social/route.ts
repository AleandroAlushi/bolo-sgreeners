import "server-only";
/** Aiuti comuni delle route /grafiche che usano le grafiche nuove. */
import { getStaff } from "@/lib/admin/auth";
import { optionsFrom } from "@/lib/graphics/theme";
import { publicMediaUrl } from "@/lib/media";
import { fadedCutout, scaledCutout, tintedOnBase, type PlacedImage } from "./photo";
import { getSocialKit, type SocialKit } from "./model";

/** Pacchetto della partita per l'admin, oppure la risposta d'errore da restituire. */
export async function adminKit(id: string): Promise<SocialKit | Response> {
  const admin = await getStaff();
  if (!admin) return new Response("Grafiche riservate all'admin", { status: 401 });
  const kit = await getSocialKit(id, admin.supabase);
  return kit ?? new Response("Partita non trovata", { status: 404 });
}

/** Una foto del bucket media passata nell'indirizzo (niente URL esterni). */
const mediaParam = (url: string, name: string) => {
  const p = new URL(url).searchParams.get(name);
  return p && /^[a-z0-9][a-z0-9/_.-]*\.(jpe?g|png)$/i.test(p) && !p.includes("..") ? publicMediaUrl(p) : null;
};

/** Formato e foto (?formato=post|storia&foto=grafiche/x.png&foto2=…): foto = primo piano, foto2 = dietro. */
export const socialOptions = (url: string) => {
  const o = optionsFrom(url);
  return { format: o.format, photo: o.photo, photo2: mediaParam(url, "foto2") };
};

const warn = (e: unknown) => console.error("[grafiche] foto non usabile:", e instanceof Error ? e.message : e);

/** Giocatori della presentazione (post): primo piano e dietro, colorati con la sfumatura della base. */
export async function preMatchPlayers(front: string | null, back: string | null, base: Buffer): Promise<PlacedImage[]> {
  const jobs: Promise<PlacedImage | null>[] = [];
  // con una foto sola va in primo piano
  if (front) jobs.push(tintedOnBase(front, base, { x: 420, y: 690, size: 620, byWidth: true }, 0.72, 1080).catch((e) => (warn(e), null)));
  if (back) jobs.push(tintedOnBase(back, base, { x: 640, y: 100, size: 800 }, 0.65).catch((e) => (warn(e), null)));
  return (await Promise.all(jobs)).filter((p): p is PlacedImage => Boolean(p));
}

/** Scontorno dell'MVP sfumato in basso: figura intera dalla galleria o mezzo busto. */
export async function mvpPhoto(src: string | null, full: boolean) {
  if (!src) return null;
  try {
    const p = await fadedCutout(src, full ? 880 : 760, 470);
    return p ? { ...p, full } : null;
  } catch (e) {
    warn(e);
    return null;
  }
}

/** Mezzo busto di un leader alla scala comune (gli scontorni sono già tutti alla stessa scala). */
export async function leaderPhoto(src: string | null) {
  if (!src) return null;
  try {
    return await scaledCutout(src, 0.31);
  } catch (e) {
    warn(e);
    return null;
  }
}
