import { formatBirthday } from "@/lib/domain/format";
import { getTeamSession } from "@/lib/team/auth";
import { IconCake } from "./icons";

/**
 * Compleanno del giocatore: lo vedono solo admin e account della squadra. Per i visitatori non
 * rende nulla (e la RLS non restituirebbe comunque il dato). Va usato dentro <Suspense>.
 */
export async function TeamOnlyBirthday({ playerId }: { playerId: string }) {
  const session = await getTeamSession();
  if (!session?.isMember) return null;
  const { data } = await session.supabase.from("private_profiles").select("birth_date").eq("player_id", playerId).maybeSingle();
  if (!data?.birth_date) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-secondary ring-1 ring-secondary/40" title="Visibile solo alla squadra">
      <IconCake size={12} /> {formatBirthday(data.birth_date)}
    </span>
  );
}
