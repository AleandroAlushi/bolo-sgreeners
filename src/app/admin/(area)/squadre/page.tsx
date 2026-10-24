import { AdminSection, Field, Grid, Input, Textarea } from "@/components/admin/fields";
import { ActionForm } from "@/components/admin/form";
import { Badge } from "@/components/ui";
import { publicMediaUrl } from "@/lib/media";
import { saveTeam } from "@/lib/admin/actions";
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
        <Field label="Logo" hint="Usato nelle grafiche Instagram. PNG con sfondo trasparente, massimo 5 MB." className="flex-1">
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
  const { data: teams } = await supabase.from("teams").select("*").order("name");
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
              <div className="mt-3">
                <ActionForm action={saveTeam} encType="multipart/form-data">
                  <TeamFields team={t} />
                </ActionForm>
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
