import { AdminSection } from "@/components/admin/fields";
import { MatchForm } from "@/components/admin/match-form";
import { requireAdmin } from "@/lib/admin/auth";
import { formOptions } from "@/lib/admin/queries";

export default async function NewMatchPage() {
  const { supabase } = await requireAdmin();
  const opts = await formOptions(supabase);
  return (
    <AdminSection title="Nuova partita" description="Inserisci anche le partite tra altre squadre: servono per calcolare la classifica.">
      <MatchForm competitions={opts.competitions} teams={opts.teams} venues={opts.venues} />
    </AdminSection>
  );
}
