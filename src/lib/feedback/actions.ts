"use server";

/**
 * Feedback dal sito: chiunque può inviare un'idea o segnalare un problema (anche senza account).
 * La RLS permette solo l'inserimento; leggerli e gestirli è riservato agli admin.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { fail, ok, optionalText, zodMessage, type ActionState } from "@/lib/admin/forms";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

const schema = z.object({
  kind: z.enum(["idea", "problema", "altro"], { message: "Scegli il tipo di messaggio" }),
  message: z.string().trim().min(3, "Scrivi almeno qualche parola").max(2000, "Massimo 2000 caratteri"),
  contact: optionalText.refine((v) => v === null || v.length <= 200, "Contatto troppo lungo"),
  page: optionalText.transform((v) => (v && v.startsWith("/") ? v.slice(0, 300) : null)),
  // campo nascosto: lo compilano solo i bot
  website: optionalText,
});

export async function sendFeedback(_: ActionState | null, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail("Il sito non è collegato al database: riprova più tardi.");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(zodMessage(p.error));
  if (p.data.website) return ok("Grazie!");
  const userAgent = (await headers()).get("user-agent")?.slice(0, 400) ?? null;
  const supabase = await createSessionClient();
  const { error } = await supabase.from("feedback").insert({
    kind: p.data.kind,
    message: p.data.message,
    contact: p.data.contact,
    page: p.data.page,
    user_agent: userAgent,
  });
  if (error) return fail("Invio non riuscito, riprova tra poco.");
  return ok("Grazie! Il messaggio è arrivato.");
}
