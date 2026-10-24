import Link from "next/link";
import { Field, Input } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { Badge } from "@/components/ui";
import { deleteFeedback, saveFeedbackNote, setFeedbackStatus } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";

const STATUSES = { new: "Nuovi", read: "Letti", done: "Fatti" } as const;
const MARK = { new: "Segna da leggere", read: "Segna come letto", done: "Segna come fatto" } as const;
const KINDS = { idea: { label: "Idea", tone: "primary" }, problema: { label: "Problema", tone: "loss" }, altro: { label: "Altro", tone: "neutral" } } as const;
const fmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

export default async function FeedbackAdminPage({ searchParams }: PageProps<"/admin/feedback">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const status = (typeof sp.stato === "string" && sp.stato in STATUSES ? sp.stato : "new") as keyof typeof STATUSES;
  const [{ data: items }, ...counts] = await Promise.all([
    supabase.from("feedback").select("*").eq("status", status).order("created_at", { ascending: false }),
    ...Object.keys(STATUSES).map((s) => supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  const countOf = (i: number) => counts[i].count ?? 0;
  return (
    <>
      <h1 className="display text-3xl">Feedback</h1>
      <p className="text-sm text-muted">
        Idee e segnalazioni inviate dal sito (link «Feedback» in alto e in fondo alle pagine). Li vedono solo gli admin.
      </p>
      <div className="flex flex-wrap gap-1">
        {Object.entries(STATUSES).map(([k, label], i) => (
          <Link key={k} href={`/admin/feedback?stato=${k}`} className={`rounded-full px-3 py-1 text-sm font-semibold ${k === status ? "bg-primary text-primary-ink" : "bg-surface-2 text-muted"}`}>
            {label} · {countOf(i)}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {(items ?? []).length === 0 && <p className="text-sm text-muted">Nessun feedback in questo stato.</p>}
        {(items ?? []).map((f) => {
          const kind = KINDS[f.kind as keyof typeof KINDS] ?? KINDS.altro;
          return (
            <article key={f.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={kind.tone}>{kind.label}</Badge>
                <span className="text-muted">{fmt.format(new Date(f.created_at))}</span>
                {f.page && (
                  <Link href={f.page} className="text-primary hover:underline">
                    {f.page}
                  </Link>
                )}
                {f.contact && <span className="font-semibold">{f.contact}</span>}
                {f.user_id && <Badge>con account</Badge>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{f.message}</p>
              {f.user_agent && <p className="truncate text-xs text-muted" title={f.user_agent}>{f.user_agent}</p>}
              <ActionForm action={saveFeedbackNote} submitLabel="Salva nota">
                <input type="hidden" name="id" value={f.id} />
                <Field label="Nota (solo admin)">
                  <Input name="admin_notes" defaultValue={f.admin_notes ?? ""} />
                </Field>
              </ActionForm>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUSES) as (keyof typeof STATUSES)[])
                  .filter((s) => s !== f.status)
                  .map((s) => (
                    <form key={s} action={setFeedbackStatus.bind(null, f.id, s)}>
                      <button type="submit" className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-primary/50">
                        {MARK[s]}
                      </button>
                    </form>
                  ))}
                <form action={deleteFeedback.bind(null, f.id)}>
                  <ConfirmButton message="Eliminare questo feedback?">Elimina</ConfirmButton>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
