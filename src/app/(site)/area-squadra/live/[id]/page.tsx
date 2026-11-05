import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { LiveScorer } from "@/components/live/scorer";
import { Notice } from "@/components/ui";
import type { LiveEvent, LiveRosterEntry } from "@/lib/live/engine";
import { requireTeamSession } from "@/lib/team/auth";

export const metadata: Metadata = { title: "Statistiche live", robots: { index: false } };

async function Scorer({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireTeamSession();
  if (!session.isMember) return <Notice tone="warning">Questo account non è abilitato all&apos;area squadra.</Notice>;
  const { id } = await params;
  const { supabase } = session;
  const { data: game } = await supabase.from("live_games").select("*").eq("id", id).maybeSingle();
  if (!game) notFound();
  const [{ data: events }, { data: match }, { data: own }] = await Promise.all([
    supabase.from("live_events").select("id, n, period, clock, team, player_id, kind, made").eq("game_id", id).order("n"),
    supabase.from("v_matches").select("season_id, opponent_name").eq("id", game.match_id).single(),
    supabase.from("teams").select("short_name, name").eq("is_own_team", true).single(),
  ]);
  const roster = game.roster as unknown as LiveRosterEntry[];
  const { data: photos } = await supabase
    .from("v_season_roster")
    .select("player_id, photo_path")
    .eq("season_id", match?.season_id ?? "")
    .in("player_id", roster.map((r) => r.player_id));

  return (
    <div className="space-y-3">
      <Link href="/area-squadra/live" className="text-sm text-muted hover:text-text">
        ← Statistiche live
      </Link>
      <LiveScorer
        game={{ ...game, roster }}
        initialEvents={(events ?? []) as LiveEvent[]}
        ownName={own?.short_name ?? own?.name ?? "Sgreeners"}
        opponentName={match?.opponent_name ?? game.opponent_name ?? "Avversari"}
        photos={Object.fromEntries((photos ?? []).map((p) => [p.player_id!, p.photo_path]))}
      />
    </div>
  );
}

export default function LiveScorerPage(props: PageProps<"/area-squadra/live/[id]">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <Scorer params={props.params} />
    </Suspense>
  );
}
