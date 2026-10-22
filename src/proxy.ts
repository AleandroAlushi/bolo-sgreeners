import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeSupabaseUrl } from "@/lib/env";

/**
 * Aggiorna la sessione Supabase (refresh token) nelle pagine admin e dell'area squadra.
 * Il controllo dei permessi vero e proprio avviene lato server (requireAdmin) e nella RLS.
 */
export async function proxy(request: NextRequest) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // sessione aggiornata dove servono i dati riservati: admin, area squadra e schede giocatore
  matcher: ["/admin/:path*", "/area-squadra/:path*", "/giocatori/:path*"],
};
