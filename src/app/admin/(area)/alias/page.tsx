import { AdminSection, Field, Grid, Input, Select } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { addPlayerAlias, addTeamAlias, deletePlayerAlias, deleteTeamAlias } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { formOptions } from "@/lib/admin/queries";

export default async function AliasPage() {
  const { supabase } = await requireAdmin();
  const [opts, pa, ta] = await Promise.all([
    formOptions(supabase),
    supabase.from("player_aliases").select("*").order("alias"),
    supabase.from("team_aliases").select("*").order("alias"),
  ]);
  const seasonSlug = (id: string | null) => (id ? (opts.seasons.find((s) => s.id === id)?.slug ?? "?") : "tutte");
  const playerName = (id: string) => opts.players.find((p) => p.id === id)?.name ?? "?";
  const teamName = (id: string) => opts.teams.find((t) => t.id === id)?.name ?? "?";
  return (
    <>
      <h1 className="display text-3xl font-extrabold italic">Alias</h1>
      <AdminSection title="Alias giocatori" description="Usati automaticamente negli import. Un alias su più giocatori diventa ambiguo e richiede conferma manuale.">
        <ActionForm action={addPlayerAlias} submitLabel="Aggiungi">
          <Grid cols={4}>
            <Field label="Giocatore">
              <Select name="player_id" required>
                <option value="">—</option>
                {opts.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
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
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="stat-table">
            <thead>
              <tr>
                <th>Alias</th>
                <th style={{ textAlign: "left" }}>Giocatore</th>
                <th>Stagione</th>
                <th>Numero</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(pa.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{a.alias}</td>
                  <td style={{ textAlign: "left" }}>{playerName(a.player_id)}</td>
                  <td>{seasonSlug(a.season_id)}</td>
                  <td>{a.jersey_number ?? "–"}</td>
                  <td>
                    <form action={deletePlayerAlias.bind(null, a.id)}>
                      <ConfirmButton message={`Eliminare l'alias "${a.alias}"?`}>Elimina</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
      <AdminSection title="Alias squadre" description="Soprannomi degli avversari usati nei box score (visibili solo agli admin).">
        <ActionForm action={addTeamAlias} submitLabel="Aggiungi">
          <Grid cols={3}>
            <Field label="Squadra">
              <Select name="team_id" required>
                <option value="">—</option>
                {opts.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
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
          </Grid>
        </ActionForm>
        <ul className="divide-y divide-border/60 text-sm">
          {(ta.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                <strong>{a.alias}</strong> → {teamName(a.team_id)} <span className="text-muted">({seasonSlug(a.season_id)})</span>
              </span>
              <form action={deleteTeamAlias.bind(null, a.id)}>
                <ConfirmButton message={`Eliminare l'alias "${a.alias}"?`}>Elimina</ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      </AdminSection>
    </>
  );
}
