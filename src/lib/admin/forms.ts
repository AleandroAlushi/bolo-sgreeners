/** Utility per le server action dei form admin. */
import { z } from "zod";

export interface ActionState {
  ok: boolean;
  message: string;
}

export const ok = (message: string): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

/** Campo testo: stringa vuota → null. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || Number.isInteger(v), "Deve essere un numero intero");

export const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))))
  .refine((v) => v === null || Number.isFinite(v), "Deve essere un numero");

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const slugSchema = z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Usa solo lettere minuscole, numeri e trattini");

export function formObject(fd: FormData): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of fd.entries()) if (!k.startsWith("$ACTION")) out[k] = typeof v === "string" ? v : null;
  return out;
}

export function zodMessage(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join(".") || "campo"}: ${i.message}`).join("; ");
}

export function dbMessage(error: { message: string; code?: string } | null): string {
  if (!error) return "";
  if (error.code === "23505") return "Esiste già un elemento con gli stessi dati (vincolo di unicità).";
  if (error.code === "23503") return "Operazione non possibile: l'elemento è collegato ad altri dati.";
  if (error.code === "42501") return "Permessi insufficienti.";
  return error.message;
}

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
