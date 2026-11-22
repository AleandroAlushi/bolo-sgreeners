import { AdminSection, Field, Grid, Input, Select, Textarea } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { Badge } from "@/components/ui";
import { publicMediaUrl } from "@/lib/media";
import { addTeamAlias, deleteTeamAlias, saveTeam } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import type { Tables } from "@/lib/supabase/database.types";

function TeamFields({ team }: { team?: Tables<"teams"> }) {
  return (
    <>
      {team && <input type="hidden" name="id" value={team.id} />}
      <Grid cols={2}>
        <Field label="Nome (identità stabile)">
          <Input name="name" defaultValue={team?.name ?? ""} required />
        </Field>
        <Field label="Nome breve">
          <Input name="short_name" defaultValue={team?.short_name ?? ""} />
        </Field>
        <Field label="Sigla" hint="3 lettere per le grafiche (BSG VS POR). Vuota = ricavata dal nome.">
          <Input name="code" defaultValue={team?.code ?? ""} maxLength={4} placeholder="es. POR" style={{ textTransform: "uppercase" }} />
        </Field>
        <Field label="Città">
          <Input name="city" defaultValue={team?.city ?? ""} />
        </Field>
        <Field label="Slug" hint="Vuoto = generato dal nome">
          <Input name="slug" defaultValue={team?.slug ?? ""} />
        </Field>
      </Grid>
      <div className="flex items-end gap-3">
        {team?.logo_path && (
          // eslint-disable-next-line @next/next/no-img-element -- anteprima del logo caricato
          <img src={publicMediaUrl(team.logo_path)!} alt="" className="h-14 w-14 rounded-lg bg-surface-2 object-contain p-1" />
        )}
        <Field label="Logo" hint="Usato nelle grafiche Instagram. PNG con sfondo trasparente, massimo 4 MB." className="flex-1">
          <Input name="photo" type="file" accept="image/png,image/jpeg" />
        </Field>
      </div>
      <Field label="Note">
        <Textarea name="notes" defaultValue={team?.notes ?? ""} />
      </Field>
    </>
  );
}

export default async function TeamsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: teams }, { data: aliases }, { data: seasons }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("team_aliases").select("*").order("alias"),
    supabase.from("seasons").select("id, slug").order("slug", { ascending: false }),
  ]);
  const seasonSlug = (id: string | null) => (id ? ((seasons ?? []).find((s) => s.id === id)?.slug ?? "?") : "tutte le stagioni");
  return (
    <>
      <h1 className="display text-3xl">Squadre</h1>
      <AdminSection title="Squadre" description="Il nome ufficiale di ogni stagione (con gli sponsor) si imposta nelle competizioni.">
        <div className="space-y-2">
          {(teams ?? []).map((t) => (
            <details key={t.id} className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer font-semibold">
                {t.name} {t.is_own_team && <Badge tone="primary">noi</Badge>}
              </summary>
              <div className="mt-3 space-y-5">
                <ActionForm action={saveTeam} encType="multipart/form-data">
                  <TeamFields team={t} />
                </ActionForm>
                {/* alias: come compare la squadra nei file (box score, Livescore) */}
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Alias</p>
                  <p className="text-xs text-muted">Altri nomi con cui la squadra compare nei file. Li vede solo l&apos;admin.</p>
                  <ul className="space-y-1 text-sm">
                    {(aliases ?? [])
                      .filter((a) => a.team_id === t.id)
                      .map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2">
                          <span>
                            <strong>{a.alias}</strong> <span className="text-muted">· {seasonSlug(a.season_id)}</span>
                          </span>
                          <form action={deleteTeamAlias.bind(null, a.id)}>
                            <ConfirmButton message={`Eliminare l'alias "${a.alias}"?`}>Elimina</ConfirmButton>
                          </form>
                        </li>
                      ))}
                  </ul>
                  <ActionForm action={addTeamAlias} submitLabel="Aggiungi alias">
                    <input type="hidden" name="team_id" value={t.id} />
                    <Grid cols={2}>
                      <Field label="Alias">
                        <Input name="alias" required />
                      </Field>
                      <Field label="Solo stagione">
                        <Select name="season_id" defaultValue="">
                          <option value="">Tutte</option>
                          {(seasons ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.slug}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </Grid>
                  </ActionForm>
                </div>
              </div>
            </details>
          ))}
        </div>
      </AdminSection>
      <AdminSection title="Nuova squadra">
        <ActionForm action={saveTeam} submitLabel="Crea squadra" encType="multipart/form-data">
          <TeamFields />
        </ActionForm>
      </AdminSection>
    </>
  );
}
