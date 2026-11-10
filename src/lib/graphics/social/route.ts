import "server-only";
/** Aiuti comuni delle route /grafiche che usano le grafiche nuove. */
import { getAdmin } from "@/lib/admin/auth";
import { optionsFrom } from "@/lib/graphics/theme";
import { playerPhoto, tintedPhoto } from "./photo";
import { getSocialKit, type SocialKit } from "./model";

/** Pacchetto della partita per l'admin, oppure la risposta d'errore da restituire. */
export async function adminKit(id: string): Promise<SocialKit | Response> {
  const admin = await getAdmin();
  if (!admin) return new Response("Grafiche riservate all'admin", { status: 401 });
  const kit = await getSocialKit(id, admin.supabase);
  return kit ?? new Response("Partita non trovata", { status: 404 });
}

/** Formato e foto (?formato=post|storia&foto=grafiche/x.jpg). */
export const socialOptions = (url: string) => {
  const o = optionsFrom(url);
  return { format: o.format, photo: o.photo };
};

const warn = (e: unknown) => console.error("[grafiche] foto non usabile:", e instanceof Error ? e.message : e);

/** Foto tinta per la presentazione; se non si riesce a leggerla la grafica esce senza. */
export async function safeTinted(src: string | null, w: number, h: number): Promise<string | null> {
  if (!src) return null;
  try {
    return await tintedPhoto(src, w, h);
  } catch (e) {
    warn(e);
    return null;
  }
}

/** Foto di un giocatore (scontorno o foto normale) per MVP e leader. */
export async function safePlayerPhoto(src: string | null, w: number, h: number, bust = false): Promise<{ src: string; cutout: boolean } | null> {
  if (!src) return null;
  try {
    return await playerPhoto(src, w, h, bust);
  } catch (e) {
    warn(e);
    return null;
  }
}
