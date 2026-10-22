/**
 * Variabili d'ambiente pubbliche. Se Supabase non è configurato l'app funziona comunque
 * e mostra stati vuoti (utile per il primo deploy).
 */
/**
 * L'URL del progetto va indicato come "https://<ref>.supabase.co": togliamo eventuali
 * spazi, "/" finali o "/rest/v1" copiati per errore dalla dashboard.
 */
export function normalizeSupabaseUrl(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "").replace(/\/(rest|auth|storage)\/v1$/, "");
}

export const env = {
  supabaseUrl: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const isSupabaseConfigured = () => env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
