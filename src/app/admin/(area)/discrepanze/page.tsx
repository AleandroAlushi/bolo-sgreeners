import Link from "next/link";
import { Field, Input, Select } from "@/components/admin/fields";
import { ActionForm } from "@/components/admin/form";
import { Badge } from "@/components/ui";
import { updateConflict } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";

const STATUSES = { open: "Aperte", acknowledged: "Prese in carico", resolved: "Risolte" } as const;

export default async function ConflictsPage({ searchParams }: PageProps<"/admin/discrepanze">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const status = (typeof sp.stato === "string" && sp.stato in STATUSES ? sp.stato : "open") as keyof typeof STATUSES;
  const [{ data: conflicts }, { data: sources }, { data: matches }] = await Promise.all([
    supabase.from("source_conflicts").select("*").eq("status", status).order("created_at", { ascending: false }),
    supabase.from("data_sources").select("id, label, kind"),
    supabase.from("v_matches").select("id, match_date, home_team_name, away_team_name"),
  ]);
  const src = (id: string | null) => (sources ?? []).find((s) => s.id === id);
  return (
    <>
      <h1 className="display text-3xl font-extrabold italic">Discrepanze tra fonti</h1>
      <p className="text-sm text-muted">
        Vale sempre la fonte primaria (CSI per risultati e calendario, HTML per le statistiche). Le discrepanze non vengono mai risolte
        automaticamente: qui puoi verificarle e annotarle.
      </p>
      <div className="flex gap-1">
        {Object.entries(STATUSES).map(([k, label]) => (
          <Link key={k} href={`/admin/discrepanze?stato=${k}`} className={`rounded-full px-3 py-1 text-sm font-semibold ${k === status ? "bg-primary text-primary-ink" : "bg-surface-2 text-muted"}`}>
            {label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {(conflicts ?? []).length === 0 && <p className="text-sm text-muted">Nessuna discrepanza in questo stato.</p>}
        {(conflicts ?? []).map((c) => {
          const m = (matches ?? []).find((x) => x.id === c.match_id);
          return (
            <div key={c.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{c.entity_type}</Badge>
                <Badge>{c.field}</Badge>
                {m && (
                  <Link href={`/admin/partite/${m.id}`} className="text-sm text-primary hover:underline">
                    {m.match_date} · {m.home_team_name} – {m.away_team_name}
                  </Link>
                )}
              </div>
              <p className="text-sm">{c.description}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-surface-2 p-2">
                  <dt className="text-xs text-muted">Primaria {src(c.primary_source_id) ? `· ${src(c.primary_source_id)!.label}` : ""}</dt>
                  <dd className="font-semibold">{c.primary_value ?? "–"}</dd>
                </div>
                <div className="rounded-lg bg-surface-2 p-2">
                  <dt className="text-xs text-muted">Secondaria {src(c.secondary_source_id) ? `· ${src(c.secondary_source_id)!.label}` : ""}</dt>
                  <dd className="font-semibold">{c.secondary_value ?? "–"}</dd>
                </div>
              </dl>
              <ActionForm action={updateConflict} submitLabel="Aggiorna">
                <input type="hidden" name="id" value={c.id} />
                <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                  <Field label="Stato">
                    <Select name="status" defaultValue={c.status}>
                      {Object.entries(STATUSES).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Nota">
                    <Input name="resolution_note" defaultValue={c.resolution_note ?? ""} />
                  </Field>
                </div>
              </ActionForm>
            </div>
          );
        })}
      </div>
    </>
  );
}
