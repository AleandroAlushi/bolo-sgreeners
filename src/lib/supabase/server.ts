import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client legato alla sessione dell'utente (cookie). Usato solo nell'area admin:
 * le scritture passano dalla RLS con il ruolo dell'utente autenticato.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // chiamato da un Server Component: il refresh dei cookie lo fa il proxy
        }
      },
    },
  });
}
