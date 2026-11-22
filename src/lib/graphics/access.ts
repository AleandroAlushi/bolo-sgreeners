import "server-only";
import { getStaff } from "@/lib/admin/auth";

/** Le grafiche sono riservate ad admin e Statistiche: per gli altri una risposta 401, altrimenti null. */
export async function adminOnly(): Promise<Response | null> {
  return (await getStaff()) ? null : new Response("Grafiche riservate all'admin", { status: 401 });
}
