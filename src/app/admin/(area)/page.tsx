import Link from "next/link";
import { AdminSection } from "@/components/admin/fields";
import { Badge, Notice, StatCard } from "@/components/ui";
import { refreshPublicSite } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const { supabase } = await requireAdmin();
  const refreshed = (await searchParams).aggiornato === "1";
  const count = async (table: "matches" | "players" | "seasons") => (await supabase.from(table).select("id", { count: "exact", head: true })).count ?? 0;
  const [matches, players, seasons, openConflicts, imports] = await Promise.all([
    count("matches"),
    count("players"),
    count("seasons"),
    supabase.from("source_conflicts").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("imports").select("id, status, file_name, created_at, match_id, error_message").order("created_at", { ascending: false }).limit(12),
  ]);
  return (
    <>
      <h1 className="display text-3xl">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Stagioni" value={seasons} />
        <StatCard label="Partite" value={matches} />
        <StatCard label="Giocatori" value={players} />
        <Link href="/admin/discrepanze">
          <StatCard label="Discrepanze aperte" value={openConflicts.count ?? 0} accent="accent" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/import" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
          Importa un box score
        </Link>
        <Link href="/admin/partite/nuova" className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
          Nuova partita
        </Link>
        <form action={refreshPublicSite}>
          <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50">
            Aggiorna il sito pubblico
          </button>
        </form>
      </div>
      {refreshed ? (
        <Notice>Pagine pubbliche aggiornate: i nuovi dati sono visibili da subito.</Notice>
      ) : (
        <p className="text-xs text-muted">
          Dopo aver lanciato l&apos;import storico dal computer, premi «Aggiorna il sito pubblico» per mostrare subito i dati nuovi.
        </p>
      )}
      <AdminSection title="Ultimi import" description="Audit degli import: file, stato, errori e partita collegata.">
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
                  <td>{i.match_id ? <Link className="text-primary hover:underline" href={`/admin/partite/${i.match_id}`}>apri</Link> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </>
  );
}
