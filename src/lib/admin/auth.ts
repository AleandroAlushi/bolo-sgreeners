import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

/** Ruoli che entrano nell'area admin: admin (tutto) e stats (statistiche live, Oggi, grafiche). */
export type StaffRole = "admin" | "stats";

async function currentRole() {
  // sempre a richiesta: sessione e scadenza dei token dipendono dal momento della richiesta
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  return { user, supabase, role: (role?.role ?? null) as string | null };
}

/** Utente corrente se è admin, altrimenti null. La RLS resta comunque l'ultima barriera. */
export async function getAdmin() {
  const c = await currentRole();
  if (!c || c.role !== "admin") return null;
  return { user: c.user, supabase: c.supabase };
}

/**
 * Utente dell'area admin: admin oppure "Statistiche" (chi prende le statistiche a bordo campo).
 * Le pagine e le azioni riservate all'admin usano requireAdmin; Oggi e Grafiche usano questa.
 */
export async function getStaff() {
  const c = await currentRole();
  if (!c || (c.role !== "admin" && c.role !== "stats")) return null;
  return { user: c.user, supabase: c.supabase, role: c.role as StaffRole, isAdmin: c.role === "admin" };
}

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  return staff;
}

export async function requireAdmin() {
  const c = await currentRole();
  if (!c || (c.role !== "admin" && c.role !== "stats")) redirect("/admin/login");
  // "Statistiche" su una pagina solo admin: torna a Oggi invece che al login
  if (c.role !== "admin") redirect("/admin");
  return { user: c.user, supabase: c.supabase };
}
