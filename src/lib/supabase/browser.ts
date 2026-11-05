/**
 * Client Supabase per il browser: con la sessione dei cookie (chi prende le statistiche live)
 * oppure anonimo (chi guarda la diretta). Solo per le parti interattive in tempo reale.
 */
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function browserClient() {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
