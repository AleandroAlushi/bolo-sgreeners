import { savePlayer } from "@/lib/admin/actions";
import type { Tables } from "@/lib/supabase/database.types";
import { Field, Grid, Input, Select, Textarea } from "./fields";
import { ActionForm } from "./form";
import { PhotoInput } from "./photo-input";

export function PlayerForm({ player }: { player?: Tables<"players"> | null }) {
  return (
    <ActionForm action={savePlayer} submitLabel={player ? "Salva giocatore" : "Crea giocatore"} encType="multipart/form-data">
      {player && <input type="hidden" name="id" value={player.id} />}
      <Grid cols={3}>
        <Field label="Nome">
          <Input name="first_name" defaultValue={player?.first_name ?? ""} required />
        </Field>
        <Field label="Cognome">
          <Input name="last_name" defaultValue={player?.last_name ?? ""} required />
        </Field>
        <Field label="Soprannome principale">
          <Input name="nickname" defaultValue={player?.nickname ?? ""} />
        </Field>
      </Grid>
      <Grid cols={2}>
        <Field label="Slug (URL)" hint="Vuoto = generato da nome e cognome">
          <Input name="slug" defaultValue={player?.slug ?? ""} />
        </Field>
        <Field label="Foto" hint="JPG/PNG: le foto grandi vengono ridotte in automatico.">
          <PhotoInput name="photo" />
        </Field>
      </Grid>
      <Grid cols={2}>
        <Field label="Altezza (cm)">
          <Input name="height_cm" type="number" min={120} max={240} defaultValue={player?.height_cm ?? ""} />
        </Field>
        <Field label="Mano">
          <Select name="hand" defaultValue={player?.hand ?? ""}>
            <option value="">—</option>
            <option value="destro">Destro</option>
            <option value="mancino">Mancino</option>
            <option value="mistero">Mistero</option>
          </Select>
        </Field>
      </Grid>
      <Field label="Bio (pubblica)">
        <Textarea name="bio" defaultValue={player?.bio ?? ""} />
      </Field>
      <Field label="Note interne">
        <Textarea name="notes" defaultValue={player?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
