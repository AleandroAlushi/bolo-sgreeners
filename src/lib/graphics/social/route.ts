import "server-only";
/** Aiuti comuni delle route /grafiche che usano le grafiche nuove. */
import { getAdmin } from "@/lib/admin/auth";
import { optionsFrom } from "@/lib/graphics/theme";
import { croppedPhoto, tintedPhoto } from "./photo";
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

/** Foto pronta per la grafica; se non si riesce a leggerla la grafica esce senza. */
export async function safePhoto(src: string | null, w: number, h: number, kind: "tinta" | "ritaglio"): Promise<string | null> {
  if (!src) return null;
  try {
    return kind === "tinta" ? await tintedPhoto(src, w, h) : await croppedPhoto(src, w, h);
  } catch (e) {
    console.error("[grafiche] foto non usabile:", e instanceof Error ? e.message : e);
    return null;
  }
}
