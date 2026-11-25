import type { Tables } from "@/lib/supabase/database.types";
import { Checkbox, Field, Input } from "./fields";

/** Data di nascita (anche solo giorno e mese) ed esenzione dai turni delle paste: dati riservati. */
export function PrivateProfileFields({
  profile,
  label = "Data di nascita",
  season,
}: {
  profile?: Pick<Tables<"private_profiles">, "birth_date" | "birth_year_known" | "paste_day" | "paste_exempt" | "instagram" | "paste_done_season"> | null;
  label?: string;
  /** stagione in corso (es. "2026-27"): per segnare le paste già portate */
  season?: string | null;
}) {
  const unknownYear = profile?.birth_year_known === false;
  return (
    <>
      <Field label={label} hint={unknownYear ? "Anno non noto: conta solo giorno e mese." : undefined}>
        <Input type="date" name="birth_date" defaultValue={profile?.birth_date ?? ""} />
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox name="year_unknown" label="Conosco solo giorno e mese" defaultChecked={unknownYear} />
      </div>
      <Field label="Giorno delle paste (gg/mm)" hint="Le porta una volta l'anno, al primo allenamento libero da questo giorno.">
        <Input name="paste_day" defaultValue={profile?.paste_day ? `${profile.paste_day.slice(3)}/${profile.paste_day.slice(0, 2)}` : ""} placeholder="es. 04/10" inputMode="numeric" />
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {season && (
          <>
            <input type="hidden" name="paste_season" value={season} />
            <Checkbox name="paste_done" label={`Paste portate nel ${season}`} defaultChecked={profile?.paste_done_season === season} />
          </>
        )}
        <Checkbox name="paste_exempt" label="Esente dalle paste" defaultChecked={profile?.paste_exempt ?? false} />
      </div>
      <Field label="Instagram" hint="Il profilo da taggare nelle didascalie delle grafiche (es. per l'MVP), senza @.">
        <Input name="instagram" defaultValue={profile?.instagram ?? ""} placeholder="es. francescocariniii" autoCapitalize="none" />
      </Field>
    </>
  );
}
