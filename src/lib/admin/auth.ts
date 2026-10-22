import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

/** Utente corrente se è admin, altrimenti null. La RLS resta comunque l'ultima barriera. */
export async function getAdmin() {
  // sempre a richiesta: sessione e scadenza dei token dipendono dal momento della richiesta
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (role?.role !== "admin") return null;
  return { user, supabase };
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
