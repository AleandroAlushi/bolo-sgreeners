import Link from "next/link";
import { AdminSection } from "@/components/admin/fields";
import { Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * Archivio: strumenti dell'import storico che non servono più tutti i giorni (le statistiche ora
 * si prendono in diretta). Restano qui, fuori dal menu principale, se mai servissero.
 */
export default async function ArchivePage() {
  const { supabase } = await requireAdmin();
  const [openConflicts, imports] = await Promise.all([
    supabase.from("source_conflicts").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("imports").select("id, status, file_name, created_at, match_id, error_message").order("created_at", { ascending: false }).limit(20),
  ]);
  const open = openConflicts.count ?? 0;
  return (
    <>
      <div>
        <h1 className="display text-3xl">Archivio</h1>
        <p className="text-sm text-muted">
          Strumenti dell&apos;import storico. Le statistiche ora si prendono in diretta, quindi qui non serve più passare; restano per
          i casi particolari.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/import" className="card space-y-1 p-4 hover:border-primary/40">
          <p className="font-semibold">Importa un box score</p>
          <p className="text-sm text-muted">Il file HTML di Easy Stats, per una partita senza diretta.</p>
        </Link>
        <Link href="/admin/discrepanze" className="card space-y-1 p-4 hover:border-primary/40">
          <p className="flex items-center gap-2 font-semibold">
            Discrepanze tra fonti {open > 0 ? <Badge tone="warning">{open} aperte</Badge> : <Badge tone="win">nessuna aperta</Badge>}
          </p>
          <p className="text-sm text-muted">Differenze tra Livescore, box score ed Excel, già risolte.</p>
        </Link>
      </div>
      <AdminSection title="Registro degli import" description="Gli ultimi file importati: stato, errori e partita collegata.">
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="stat-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Stato</th>
                <th>Data</th>
                <th>Partita</th>
              </tr>
            </thead>
            <tbody>
              {(imports.data ?? []).map((i) => (
                <tr key={i.id}>
                  <td className="max-w-[18rem] truncate" title={i.error_message ?? undefined}>
                    {i.file_name}
                  </td>
                  <td>
                    <Badge tone={i.status === "completed" ? "win" : i.status === "failed" ? "loss" : "neutral"}>{i.status}</Badge>
                  </td>
                  <td>{new Date(i.created_at).toLocaleString("it-IT")}</td>
                  <td>
                    {i.match_id ? (
                      <Link className="text-primary hover:underline" href={`/admin/partite/${i.match_id}`}>
                        apri
                      </Link>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </>
  );
}
