import { AdminSection, Field, Grid, Input, Select, Textarea } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { removeSeasonStaff, savePrivateProfile, saveSeasonStaff, saveStaffMember } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { formOptions } from "@/lib/admin/queries";
import type { Tables } from "@/lib/supabase/database.types";

const ROLES = ["Allenatore", "Vice allenatore", "Dirigente accompagnatore", "Statistiche", "Preparatore atletico"];

function StaffFields({ member, players }: { member?: Tables<"staff_members">; players: { id: string; name: string }[] }) {
  return (
    <>
      {member && <input type="hidden" name="id" value={member.id} />}
      <Grid cols={3}>
        <Field label="Nome">
          <Input name="first_name" defaultValue={member?.first_name ?? ""} required />
        </Field>
        <Field label="Cognome">
          <Input name="last_name" defaultValue={member?.last_name ?? ""} required />
        </Field>
        <Field label="Gioca anche?" hint="Collega la scheda giocatore">
          <Select name="player_id" defaultValue={member?.player_id ?? ""}>
            <option value="">No</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </Grid>
      <Grid cols={2}>
        <Field label="Foto" hint="Se gioca, vale anche la foto della scheda giocatore">
          <Input name="photo" type="file" accept="image/*" />
        </Field>
        <Field label="Note">
          <Textarea name="notes" defaultValue={member?.notes ?? ""} rows={1} />
        </Field>
      </Grid>
    </>
  );
}

export default async function AdminStaffPage() {
  const { supabase } = await requireAdmin();
  const [opts, staff, roles, profiles] = await Promise.all([
    formOptions(supabase),
    supabase.from("staff_members").select("*").order("last_name"),
    supabase.from("season_staff").select("*").order("sort_order"),
    supabase.from("private_profiles").select("staff_id, birth_date").not("staff_id", "is", null),
  ]);
  const members = staff.data ?? [];
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? "?";
  const seasons = [...opts.seasons].sort((a, b) => b.slug.localeCompare(a.slug));
  return (
    <>
      <h1 className="display text-3xl">Staff</h1>
      <AdminSection title="Staff per stagione" description="Chi fa parte dello staff in ogni stagione e con quale ruolo (l'ordine decide la posizione nella pagina).">
        {seasons.map((s) => {
          const rows = (roles.data ?? []).filter((r) => r.season_id === s.id);
          return (
            <div key={s.id} className="rounded-xl border border-border p-3">
              <p className="display mb-2 text-lg">{s.slug}</p>
              {rows.length === 0 && <p className="text-sm text-muted">Nessuno.</p>}
              <ul className="space-y-1">
                {rows.map((r) => (
                  <li key={`${r.staff_id}-${r.role}`} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <strong>{name(r.staff_id)}</strong> <span className="text-muted">· {r.role}</span>
                    </span>
                    <form action={removeSeasonStaff.bind(null, r.season_id, r.staff_id, r.role)}>
                      <ConfirmButton message={`Togliere ${name(r.staff_id)} (${r.role}) dallo staff ${s.slug}?`}>Rimuovi</ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="rounded-xl border border-dashed border-border p-3">
          <p className="mb-2 text-sm font-semibold">Aggiungi un ruolo</p>
          <ActionForm action={saveSeasonStaff} submitLabel="Aggiungi">
            <Grid cols={4}>
              <Field label="Stagione">
                <Select name="season_id" required>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.slug}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Persona">
                <Select name="staff_id" required>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ruolo">
                <Input name="role" list="ruoli-staff" required />
                <datalist id="ruoli-staff">
                  {ROLES.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label="Ordine" hint="0 = primo">
                <Input name="sort_order" inputMode="numeric" defaultValue="0" />
              </Field>
            </Grid>
          </ActionForm>
        </div>
      </AdminSection>

      <AdminSection title="Persone" description="La data di nascita è riservata: la vedono solo l'admin e gli account della squadra.">
        {members.map((m) => (
          <div key={m.id} className="space-y-3 rounded-xl border border-border p-3">
            <p className="display text-lg">{m.display_name}</p>
            <ActionForm action={saveStaffMember} encType="multipart/form-data">
              <StaffFields member={m} players={opts.players} />
            </ActionForm>
            {m.player_id ? (
              <p className="text-xs text-muted">Data di nascita: si inserisce nella scheda giocatore.</p>
            ) : (
              <ActionForm action={savePrivateProfile} submitLabel="Salva data">
                <input type="hidden" name="staff_id" value={m.id} />
                <Field label="Data di nascita (riservata)">
                  <Input type="date" name="birth_date" defaultValue={(profiles.data ?? []).find((p) => p.staff_id === m.id)?.birth_date ?? ""} />
                </Field>
              </ActionForm>
            )}
          </div>
        ))}
      </AdminSection>

      <AdminSection title="Nuovo membro dello staff">
        <ActionForm action={saveStaffMember} submitLabel="Aggiungi" encType="multipart/form-data">
          <StaffFields players={opts.players} />
        </ActionForm>
      </AdminSection>
    </>
  );
}
