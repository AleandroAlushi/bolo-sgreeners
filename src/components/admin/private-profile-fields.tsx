import type { Tables } from "@/lib/supabase/database.types";
import { Checkbox, Field, Input } from "./fields";

/** Data di nascita (anche solo giorno e mese) ed esenzione dai turni delle paste: dati riservati. */
export function PrivateProfileFields({ profile, label = "Data di nascita" }: { profile?: Pick<Tables<"private_profiles">, "birth_date" | "birth_year_known" | "paste_exempt"> | null; label?: string }) {
  const unknownYear = profile?.birth_year_known === false;
  return (
    <>
      <Field label={label} hint={unknownYear ? "Anno non noto: conta solo giorno e mese." : undefined}>
        <Input type="date" name="birth_date" defaultValue={profile?.birth_date ?? ""} />
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox name="year_unknown" label="Conosco solo giorno e mese" defaultChecked={unknownYear} />
        <Checkbox name="paste_exempt" label="Esente dai turni delle paste" defaultChecked={profile?.paste_exempt ?? false} />
      </div>
    </>
  );
}
