import { saveMatch } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { Checkbox, Field, Grid, Input, Select, Textarea } from "./fields";
import { ActionForm } from "./form";

interface Props {
  match?: Tables<"matches"> | null;
  competitions: { id: string; name: string; season_slug: string }[];
  teams: { id: string; name: string }[];
  venues: { id: string; name: string }[];
}

export function MatchForm({ match: m, competitions, teams, venues }: Props) {
  return (
    <ActionForm action={saveMatch} submitLabel={m ? "Salva partita" : "Crea partita"}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <Grid cols={3}>
        <Field label="Competizione">
          <Select name="competition_id" defaultValue={m?.competition_id ?? ""} required>
            <option value="">—</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.season_slug} · {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Giornata (numero)">
          <Input name="round_number" type="number" min={1} defaultValue={m?.round_number ?? ""} />
        </Field>
        <Field label="Etichetta turno" hint="es. Gara 2, Finale">
          <Input name="round_label" defaultValue={m?.round_label ?? ""} />
        </Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Data">
          <Input name="match_date" type="date" defaultValue={m?.match_date ?? ""} />
        </Field>
        <Field label="Ora">
          <Input name="start_time" type="time" defaultValue={m?.start_time?.slice(0, 5) ?? ""} />
        </Field>
        <Field label="Stato">
          <Select name="status" defaultValue={m?.status ?? "scheduled"}>
            <option value="scheduled">In programma</option>
            <option value="played">Giocata</option>
            <option value="postponed">Rinviata</option>
            <option value="cancelled">Annullata</option>
            <option value="forfeit">A tavolino</option>
          </Select>
        </Field>
      </Grid>
      <Grid cols={2}>
        <Field label="Squadra di casa">
          <Select name="home_team_id" defaultValue={m?.home_team_id ?? ""} required>
            <option value="">—</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Squadra ospite">
          <Select name="away_team_id" defaultValue={m?.away_team_id ?? ""} required>
            <option value="">—</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Punti casa">
          <Input name="home_score" type="number" min={0} defaultValue={m?.home_score ?? ""} />
        </Field>
        <Field label="Punti ospite">
          <Input name="away_score" type="number" min={0} defaultValue={m?.away_score ?? ""} />
        </Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Palestra">
          <Select name="venue_id" defaultValue={m?.venue_id ?? ""}>
            <option value="">— nessuna / nuova —</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nuova palestra (nome)">
          <Input name="new_venue_name" />
        </Field>
        <Field label="Nuova palestra (indirizzo)">
          <Input name="new_venue_address" />
        </Field>
      </Grid>
      <Grid cols={3}>
        <Field label="Verifica identificazione">
          <Select name="verification" defaultValue={m?.verification ?? "verified"}>
            <option value="verified">Verificata</option>
            <option value="probable">Probabile</option>
            <option value="to_verify">Da verificare</option>
          </Select>
        </Field>
        <Field label="ID partita CSI">
          <Input name="csi_match_id" type="number" defaultValue={m?.csi_match_id ?? ""} />
        </Field>
        <Field label="Codice gara CSI">
          <Input name="csi_game_code" defaultValue={m?.csi_game_code ?? ""} />
        </Field>
      </Grid>
      <Checkbox name="home_away_confirmed" label="Casa/trasferta confermati dalla fonte" defaultChecked={m?.home_away_confirmed ?? true} />
      <Field label="Note (pubbliche)">
        <Textarea name="notes" defaultValue={m?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
