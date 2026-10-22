import Link from "next/link";
import { AdminSection, Checkbox, Field, Grid, Input, Select } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { Badge } from "@/components/ui";
import { addTrainingBreak, deleteTrainingBreak, saveTrainingSchedule, setAccessRole } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate } from "@/lib/domain/format";

const WEEKDAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

export default async function AdminTeamAreaPage() {
  const { supabase } = await requireAdmin();
  const [{ data: seasons }, access, { data: schedules }, { data: breaks }] = await Promise.all([
    supabase.from("seasons").select("id, slug, is_current").order("slug", { ascending: false }),
    supabase.rpc("admin_list_access"),
    supabase.from("training_schedule").select("*"),
    supabase.from("training_breaks").select("*").order("start_date"),
  ]);
  const season = (seasons ?? []).find((s) => s.is_current) ?? seasons?.[0];
  const schedule = (schedules ?? []).find((s) => s.season_id === season?.id);
  const year = Number(season?.slug.slice(0, 4));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Area squadra</h1>
        <Link href="/area-squadra" className="text-sm text-primary hover:underline">
          Apri l&apos;area squadra →
        </Link>
      </div>

      <AdminSection
        title="Accessi"
        description={
          <>
            Chi ha il ruolo <strong>squadra</strong> entra in /area-squadra e vede compleanni e paste, senza poter modificare nulla. Crea prima l&apos;account in
            Supabase (Authentication → Users → Add user, con email e password), poi attivalo qui. Può essere un account per persona o uno condiviso da tutta la
            squadra.
          </>
        }
      >
        {access.error ? (
          <p className="text-sm text-loss">{access.error.message}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(access.data ?? []).map((u) => (
              <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{u.email}</strong>{" "}
                  {u.last_sign_in_at && <span className="text-xs text-muted">· ultimo accesso {formatDate(u.last_sign_in_at.slice(0, 10))}</span>}
                </span>
                <Badge tone={u.role === "admin" ? "primary" : u.role === "team" ? "secondary" : "neutral"}>
                  {u.role === "admin" ? "admin" : u.role === "team" ? "squadra" : "nessun accesso"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={setAccessRole} submitLabel="Applica">
          <Grid cols={2}>
            <Field label="Email dell'account">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Accesso">
              <Select name="role" defaultValue="team">
                <option value="team">Squadra (sola lettura, dati riservati)</option>
                <option value="admin">Admin (può modificare tutto)</option>
                <option value="">Nessuno (togli l&apos;accesso)</option>
              </Select>
            </Field>
          </Grid>
        </ActionForm>
      </AdminSection>

      {season && (
        <AdminSection title={`Allenamenti ${season.slug}`} description="Servono per il calendario delle paste: giorni della settimana e periodo della stagione.">
          <ActionForm action={saveTrainingSchedule}>
            <input type="hidden" name="season_id" value={season.id} />
            <Grid cols={2}>
              <Field label="Primo allenamento (dal)">
                <Input type="date" name="start_date" defaultValue={schedule?.start_date ?? `${year}-09-01`} required />
              </Field>
              <Field label="Ultimo allenamento (al)">
                <Input type="date" name="end_date" defaultValue={schedule?.end_date ?? `${year + 1}-05-31`} required />
              </Field>
            </Grid>
            <div className="flex flex-wrap gap-4">
              {WEEKDAYS.map((d, i) => (
                <Checkbox key={d} name="weekdays" value={String(i + 1)} label={d} defaultChecked={(schedule?.weekdays ?? [1, 4]).includes(i + 1)} />
              ))}
            </div>
          </ActionForm>
        </AdminSection>
      )}

      {season && (
        <AdminSection title="Pause" description="Periodi senza allenamenti (vacanze di Natale, Pasqua…): chi compie gli anni in pausa recupera al rientro.">
          <ul className="space-y-1">
            {(breaks ?? [])
              .filter((b) => b.season_id === season.id)
              .map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <strong>{b.label}</strong>{" "}
                    <span className="text-muted">
                      · {formatDate(b.start_date)} – {formatDate(b.end_date)}
                    </span>
                  </span>
                  <form action={deleteTrainingBreak.bind(null, b.id)}>
                    <ConfirmButton message={`Eliminare la pausa "${b.label}"?`}>Elimina</ConfirmButton>
                  </form>
                </li>
              ))}
          </ul>
          <ActionForm action={addTrainingBreak} submitLabel="Aggiungi pausa">
            <input type="hidden" name="season_id" value={season.id} />
            <Grid cols={3}>
              <Field label="Nome">
                <Input name="label" placeholder="Vacanze di Natale" required />
              </Field>
              <Field label="Dal">
                <Input type="date" name="start_date" required />
              </Field>
              <Field label="Al (compreso)">
                <Input type="date" name="end_date" required />
              </Field>
            </Grid>
          </ActionForm>
        </AdminSection>
      )}
    </>
  );
}
