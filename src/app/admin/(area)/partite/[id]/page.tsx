import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSection, Select } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { MatchForm } from "@/components/admin/match-form";
import { Badge } from "@/components/ui";
import { deleteMatch, savePlayerLine } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { formOptions } from "@/lib/admin/queries";

const STAT_INPUTS = [
  ["minutes", "MIN"],
  ["points", "PTS"],
  ["fgm", "FGM"],
  ["fga", "FGA"],
  ["fg3m", "3PM"],
  ["fg3a", "3PA"],
  ["ftm", "FTM"],
  ["fta", "FTA"],
  ["oreb", "RO"],
  ["dreb", "RD"],
  ["reb", "RT"],
  ["ast", "AST"],
  ["stl", "REC"],
  ["tov", "PP"],
  ["blk", "STP"],
  ["pf", "F"],
  ["plus_minus", "+/-"],
] as const;

export default async function AdminMatchPage({ params }: PageProps<"/admin/partite/[id]">) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!match) notFound();
  const [opts, lines, conflicts, imports] = await Promise.all([
    formOptions(supabase),
    supabase.from("player_match_stats").select("*").eq("match_id", id).order("points", { ascending: false, nullsFirst: false }),
    supabase.from("source_conflicts").select("*").eq("match_id", id).order("created_at"),
    supabase.from("imports").select("id, status, file_name, parser, parser_version, created_at, storage_path").eq("match_id", id).order("created_at"),
  ]);
  const remove = deleteMatch.bind(null, id);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl font-extrabold italic">Modifica partita</h1>
        <div className="flex items-center gap-2">
          <Link href={`/partite/${id}`} className="text-sm text-primary hover:underline">
            Pagina pubblica
          </Link>
          <form action={remove}>
            <ConfirmButton message="Eliminare la partita e tutte le sue statistiche?">Elimina</ConfirmButton>
          </form>
        </div>
      </div>
      <AdminSection title="Dati partita" description="Il risultato ufficiale è quello CSI: modificarlo qui lo registra come inserimento manuale.">
        <MatchForm match={match} competitions={opts.competitions} teams={opts.teams} venues={opts.venues} />
      </AdminSection>

      <AdminSection title="Statistiche giocatori" description="Correggi i valori importati: ogni modifica resta tracciata tra le discrepanze (risolte). Campo vuoto = statistica non registrata.">
        {(lines.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            Nessuna statistica. <Link href="/admin/import" className="text-primary underline">Importa un box score</Link>.
          </p>
        ) : (
          <div className="space-y-3">
            {(lines.data ?? []).map((l) => (
              <div key={l.id} className="rounded-xl border border-border p-3">
                <ActionForm action={savePlayerLine} submitLabel="Salva riga">
                  <input type="hidden" name="id" value={l.id} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {l.jersey_number ? `#${l.jersey_number} ` : ""}
                      {l.raw_name}
                    </span>
                    {l.participation === "dnp" && <Badge>0 minuti</Badge>}
                    <Select name="player_id" defaultValue={l.player_id ?? ""} className="max-w-[14rem]">
                      <option value="">— non attribuita —</option>
                      {opts.players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9 lg:grid-cols-[repeat(17,minmax(0,1fr))]">
                    {STAT_INPUTS.map(([k, label]) => (
                      <label key={k} className="text-center">
                        <span className="block text-[0.6rem] font-semibold text-muted">{label}</span>
                        <input
                          name={k}
                          defaultValue={l[k] ?? ""}
                          inputMode="decimal"
                          className="w-full rounded-md border border-border bg-surface-2 px-1 py-1 text-center text-sm tabular-nums focus:border-primary focus:outline-none"
                        />
                      </label>
                    ))}
                  </div>
                </ActionForm>
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Import e discrepanze">
        <ul className="space-y-1 text-sm">
          {(imports.data ?? []).map((i) => (
            <li key={i.id}>
              <Badge tone={i.status === "completed" ? "win" : "neutral"}>{i.status}</Badge> {i.file_name} · {i.parser} {i.parser_version} ·{" "}
              {new Date(i.created_at).toLocaleString("it-IT")}
            </li>
          ))}
          {(conflicts.data ?? []).map((c) => (
            <li key={c.id} className="text-warning">
              ⚠ {c.description} ({c.field}: {c.primary_value} vs {c.secondary_value}) — {c.status}
            </li>
          ))}
          {(imports.data ?? []).length + (conflicts.data ?? []).length === 0 && <li className="text-muted">Nessun import o discrepanza.</li>}
        </ul>
      </AdminSection>
    </>
  );
}
