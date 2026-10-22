import { AdminSection, Checkbox, Field, Grid, Input, Select, Textarea } from "@/components/admin/fields";
import { ActionForm, ConfirmButton } from "@/components/admin/form";
import { Badge } from "@/components/ui";
import {
  deleteAdjustment,
  removeCompetitionTeam,
  saveAdjustment,
  saveCompetition,
  saveCompetitionTeam,
  saveSeason,
  saveStandingsRule,
} from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import type { Tables } from "@/lib/supabase/database.types";

const KINDS = { regular_season: "Regular season", poule: "Poule", playoff: "Playoff", cup: "Coppa", friendly: "Amichevole", other: "Altro" };

function SeasonFields({ s }: { s?: Tables<"seasons"> }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <Grid cols={4}>
        <Field label="Stagione" hint="es. 2026-27">
          <Input name="slug" defaultValue={s?.slug ?? ""} required pattern="\d{4}-\d{2}" />
        </Field>
        <Field label="Etichetta">
          <Input name="label" defaultValue={s?.label ?? ""} required />
        </Field>
        <Field label="Inizio">
          <Input name="start_date" type="date" defaultValue={s?.start_date ?? ""} />
        </Field>
        <Field label="Fine">
          <Input name="end_date" type="date" defaultValue={s?.end_date ?? ""} />
        </Field>
      </Grid>
      <Checkbox name="is_current" label="Stagione corrente" defaultChecked={s?.is_current ?? false} />
      <Field label="Note">
        <Textarea name="notes" defaultValue={s?.notes ?? ""} />
      </Field>
    </>
  );
}

function CompetitionFields({ seasonId, c }: { seasonId: string; c?: Tables<"competitions"> }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="season_id" value={seasonId} />
      <Grid cols={4}>
        <Field label="Nome ufficiale">
          <Input name="name" defaultValue={c?.name ?? ""} required />
        </Field>
        <Field label="Tipo">
          <Select name="kind" defaultValue={c?.kind ?? "regular_season"}>
            {Object.entries(KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ordine fase">
          <Input name="phase_order" type="number" min={1} defaultValue={c?.phase_order ?? 1} />
        </Field>
        <Field label="Project ID CSI">
          <Input name="csi_project_id" type="number" defaultValue={c?.csi_project_id ?? ""} />
        </Field>
      </Grid>
      <Grid cols={2}>
        <Field label="Slug" hint="Vuoto = dal nome">
          <Input name="slug" defaultValue={c?.slug ?? ""} />
        </Field>
        <Field label="Formula / note">
          <Input name="format_notes" defaultValue={c?.format_notes ?? ""} />
        </Field>
      </Grid>
    </>
  );
}

export default async function SeasonsAdminPage() {
  const { supabase } = await requireAdmin();
  const [seasons, comps, rules, entries, adjustments, teams] = await Promise.all([
    supabase.from("seasons").select("*").order("slug", { ascending: false }),
    supabase.from("competitions").select("*").order("phase_order"),
    supabase.from("standings_rules").select("*"),
    supabase.from("competition_teams").select("*"),
    supabase.from("standings_adjustments").select("*"),
    supabase.from("teams").select("id, name").order("name"),
  ]);
  const teamName = (id: string) => (teams.data ?? []).find((t) => t.id === id)?.name ?? "?";
  return (
    <>
      <h1 className="display text-3xl font-extrabold italic">Stagioni, competizioni e classifiche</h1>
      <AdminSection title="Nuova stagione">
        <ActionForm action={saveSeason} submitLabel="Crea stagione">
          <SeasonFields />
        </ActionForm>
      </AdminSection>
      {(seasons.data ?? []).map((s) => (
        <AdminSection key={s.id} title={`Stagione ${s.slug}`}>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-primary">Modifica stagione {s.is_current && <Badge tone="primary">corrente</Badge>}</summary>
            <div className="mt-3">
              <ActionForm action={saveSeason}>
                <SeasonFields s={s} />
              </ActionForm>
            </div>
          </details>
          {(comps.data ?? [])
            .filter((c) => c.season_id === s.id)
            .map((c) => {
              const rule = (rules.data ?? []).find((r) => r.competition_id === c.id);
              const compEntries = (entries.data ?? []).filter((e) => e.competition_id === c.id);
              const adj = (adjustments.data ?? []).filter((a) => a.competition_id === c.id);
              return (
                <details key={c.id} className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer font-semibold">
                    {c.name} <span className="text-xs text-muted">· {KINDS[c.kind]} · {compEntries.length} squadre</span>{" "}
                    {rule ? <Badge tone={rule.is_verified ? "win" : "warning"}>regole {rule.is_verified ? "verificate" : "da verificare"}</Badge> : <Badge>senza regole</Badge>}
                  </summary>
                  <div className="mt-3 space-y-5">
                    <ActionForm action={saveCompetition} submitLabel="Salva competizione">
                      <CompetitionFields seasonId={s.id} c={c} />
                    </ActionForm>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Regole di classifica</h3>
                      <ActionForm action={saveStandingsRule} submitLabel="Salva regole">
                        <input type="hidden" name="competition_id" value={c.id} />
                        <Grid cols={3}>
                          <Field label="Punti vittoria">
                            <Input name="points_win" defaultValue={rule?.points_win ?? ""} required />
                          </Field>
                          <Field label="Punti sconfitta">
                            <Input name="points_loss" defaultValue={rule?.points_loss ?? ""} required />
                          </Field>
                          <Field label="Vittoria ai supplementari" hint="vuoto = come vittoria">
                            <Input name="points_ot_win" defaultValue={rule?.points_ot_win ?? ""} />
                          </Field>
                          <Field label="Sconfitta ai supplementari" hint="vuoto = come sconfitta">
                            <Input name="points_ot_loss" defaultValue={rule?.points_ot_loss ?? ""} />
                          </Field>
                          <Field label="Vittoria a tavolino">
                            <Input name="points_forfeit_win" defaultValue={rule?.points_forfeit_win ?? ""} />
                          </Field>
                          <Field label="Sconfitta a tavolino">
                            <Input name="points_forfeit_loss" defaultValue={rule?.points_forfeit_loss ?? ""} />
                          </Field>
                        </Grid>
                        <Field label="Criteri di ordinamento" hint="In ordine, separati da virgola: points, head_to_head, quotient_total, point_quotient, point_diff, points_for, wins">
                          <Input name="tiebreakers" defaultValue={(rule?.tiebreakers ?? ["points", "head_to_head", "point_diff"]).join(", ")} />
                        </Field>
                        <Checkbox name="is_verified" label="Regolamento verificato sul CSI" defaultChecked={rule?.is_verified ?? false} />
                        <Field label="Note">
                          <Input name="notes" defaultValue={rule?.notes ?? ""} />
                        </Field>
                      </ActionForm>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Squadre partecipanti (nome ufficiale)</h3>
                      <ul className="mb-3 space-y-1 text-sm">
                        {compEntries.map((e) => (
                          <li key={e.team_id} className="flex items-center justify-between gap-2">
                            <span>
                              {e.display_name} <span className="text-muted">({teamName(e.team_id)})</span>
                            </span>
                            <form action={removeCompetitionTeam.bind(null, c.id, e.team_id)}>
                              <ConfirmButton message="Rimuovere la squadra dalla competizione?">Rimuovi</ConfirmButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                      <ActionForm action={saveCompetitionTeam} submitLabel="Aggiungi / aggiorna">
                        <input type="hidden" name="competition_id" value={c.id} />
                        <Grid cols={3}>
                          <Field label="Squadra">
                            <Select name="team_id" required>
                              <option value="">—</option>
                              {(teams.data ?? []).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Nome ufficiale in questa fase">
                            <Input name="display_name" required />
                          </Field>
                          <Field label="Team ID CSI">
                            <Input name="csi_team_id" type="number" />
                          </Field>
                        </Grid>
                      </ActionForm>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Penalizzazioni e correzioni</h3>
                      <ul className="mb-3 space-y-1 text-sm">
                        {adj.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2">
                            <span>
                              {teamName(a.team_id)}: {Number(a.points) > 0 ? `+${a.points}` : a.points} punti — {a.reason}
                            </span>
                            <form action={deleteAdjustment.bind(null, a.id)}>
                              <ConfirmButton message="Eliminare la correzione?">Elimina</ConfirmButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                      <ActionForm action={saveAdjustment} submitLabel="Aggiungi">
                        <input type="hidden" name="competition_id" value={c.id} />
                        <Grid cols={3}>
                          <Field label="Squadra">
                            <Select name="team_id" required>
                              <option value="">—</option>
                              {compEntries.map((e) => (
                                <option key={e.team_id} value={e.team_id}>
                                  {e.display_name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Punti (es. -1)">
                            <Input name="points" required />
                          </Field>
                          <Field label="Motivazione">
                            <Input name="reason" required />
                          </Field>
                        </Grid>
                      </ActionForm>
                    </div>
                  </div>
                </details>
              );
            })}
          <details className="rounded-xl border border-dashed border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold">+ Nuova competizione / fase</summary>
            <div className="mt-3">
              <ActionForm action={saveCompetition} submitLabel="Crea competizione">
                <CompetitionFields seasonId={s.id} />
              </ActionForm>
            </div>
          </details>
        </AdminSection>
      ))}
    </>
  );
}
