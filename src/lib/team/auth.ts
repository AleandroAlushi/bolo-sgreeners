import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Utente dell'area squadra: account con ruolo "team" (giocatori e staff, sola lettura) o admin.
 * I dati riservati sono comunque protetti dalla RLS (is_team_member).
 */
export async function getTeamSession() {
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const role = data?.role ?? null;
  return { user, supabase, role, isMember: role === "admin" || role === "team", isAdmin: role === "admin" };
}

export async function requireTeamSession() {
  const session = await getTeamSession();
  if (!session) redirect("/area-squadra/accedi");
  return session;
}
