import "server-only";
import { cacheLife } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

/** Tag unico di cache per i dati pubblici: ogni scrittura admin lo invalida. */
export const DATA_TAG = "sgreeners-data";

export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}

export function db() {
  return createPublicClient();
}

export const dbReady = isSupabaseConfigured;

/** Estrae i dati da una risposta Supabase (liste) o lancia un errore leggibile. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new DataError(`Impossibile leggere ${what}: ${res.error.message}`);
  return res.data as T;
}

/** Come unwrap, per query .maybeSingle(): restituisce null se la riga non esiste. */
export function unwrapMaybe<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new DataError(`Impossibile leggere ${what}: ${res.error.message}`);
  return res.data;
}

/** Data odierna (UTC) con cache oraria: serve per distinguere partite giocate e future. */
export async function getToday(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return new Date().toISOString().slice(0, 10);
}
