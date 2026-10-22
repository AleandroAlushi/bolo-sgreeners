/**
 * Variabili d'ambiente pubbliche. Se Supabase non è configurato l'app funziona comunque
 * e mostra stati vuoti (utile per il primo deploy).
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const isSupabaseConfigured = () => env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
