import "server-only";
import { getAdmin } from "@/lib/admin/auth";

/** Le grafiche sono riservate all'admin: per gli altri una risposta 401, altrimenti null. */
export async function adminOnly(): Promise<Response | null> {
  return (await getAdmin()) ? null : new Response("Grafiche riservate all'admin", { status: 401 });
}
