import { notFound } from "next/navigation";
import { AdminSection, Checkbox, Field, Grid, Input, Select } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { PlayerForm } from "@/components/admin/player-form";
import { addPlayerAlias, deletePlayerAlias, removeRosterEntry, saveRosterEntry } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { formOptions } from "@/lib/admin/queries";
import type { Tables } from "@/lib/supabase/database.types";

function RosterFields({ entry }: { entry?: Tables<"season_rosters"> }) {
  return (
    <>
      <Grid cols={3}>
        <Field label="Numero">
          <Input name="jersey_number" defaultValue={entry?.jersey_number ?? ""} inputMode="numeric" />
        </Field>
        <Field label="Ruolo">
          <Input name="role" defaultValue={entry?.role ?? ""} placeholder="es. Playmaker" />
        </Field>
        <Field label="Soprannome di stagione">
          <Input name="nickname" defaultValue={entry?.nickname ?? ""} />
        </Field>
      </Grid>
      <div className="flex gap-4">
        <Checkbox name="is_active" label="Attivo" defaultChecked={entry?.is_active ?? true} />
        <Checkbox name="is_captain" label="Capitano" defaultChecked={entry?.is_captain ?? false} />
      </div>
    </>
  );
}

export default async function AdminPlayerPage({ params }: PageProps<"/admin/giocatori/[id]">) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: player } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  if (!player) notFound();
  const [opts, rosters, aliases] = await Promise.all([
    formOptions(supabase),
    supabase.from("season_rosters").select("*").eq("player_id", id),
    supabase.from("player_aliases").select("*").eq("player_id", id).order("alias"),
  ]);
  const seasonSlug = (sid: string | null) => opts.seasons.find((s) => s.id === sid)?.slug ?? "tutte";
  const free = opts.seasons.filter((s) => !(rosters.data ?? []).some((r) => r.season_id === s.id));
  return (
    <>
      <h1 className="display text-3xl">
        {player.first_name} {player.last_name}
      </h1>
      <AdminSection title="Anagrafica">
        <PlayerForm player={player} />
      </AdminSection>
      <AdminSection title="Roster per stagione">
        {(rosters.data ?? [])
          .sort((a, b) => seasonSlug(a.season_id).localeCompare(seasonSlug(b.season_id)))
          .map((r) => (
            <div key={r.season_id} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="display text-lg">{seasonSlug(r.season_id)}</p>
                <form action={removeRosterEntry.bind(null, r.season_id, id)}>
                  <ConfirmButton message="Rimuovere il giocatore dal roster di questa stagione?">Rimuovi</ConfirmButton>
                </form>
              </div>
              <ActionForm action={saveRosterEntry}>
                <input type="hidden" name="season_id" value={r.season_id} />
                <input type="hidden" name="player_id" value={id} />
                <RosterFields entry={r} />
              </ActionForm>
            </div>
          ))}
        {free.length > 0 && (
          <div className="rounded-xl border border-dashed border-border p-3">
            <p className="mb-2 text-sm font-semibold">Aggiungi a un roster</p>
            <ActionForm action={saveRosterEntry} submitLabel="Aggiungi">
              <input type="hidden" name="player_id" value={id} />
              <Field label="Stagione">
                <Select name="season_id" required>
                  {free.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.slug}
                    </option>
                  ))}
                </Select>
              </Field>
              <RosterFields />
            </ActionForm>
          </div>
        )}
      </AdminSection>
      <AdminSection title="Alias" description="Nomi con cui il giocatore compare nei file. Limita un alias a stagione o numero di maglia se è ambiguo.">
        <ul className="space-y-1">
          {(aliases.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <strong>{a.alias}</strong> <span className="text-muted">· stagione {seasonSlug(a.season_id)}{a.jersey_number ? ` · solo con #${a.jersey_number}` : ""}</span>
              </span>
              <form action={deletePlayerAlias.bind(null, a.id)}>
                <ConfirmButton message={`Eliminare l'alias "${a.alias}"?`}>Elimina</ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm action={addPlayerAlias} submitLabel="Aggiungi alias">
          <input type="hidden" name="player_id" value={id} />
          <Grid cols={3}>
            <Field label="Alias">
              <Input name="alias" required />
            </Field>
            <Field label="Solo stagione">
              <Select name="season_id" defaultValue="">
                <option value="">Tutte</option>
                {opts.seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.slug}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Solo con numero">
              <Input name="jersey_number" inputMode="numeric" />
            </Field>
          </Grid>
        </ActionForm>
      </AdminSection>
    </>
  );
}
