import type { Metadata } from "next";
import { PlayerCard } from "@/components/player";
import { EmptyState, PageHeader } from "@/components/ui";
import { getPlayers } from "@/lib/data/players";

export const metadata: Metadata = {
  title: "Giocatori",
  description: "Tutti i giocatori che hanno vestito la maglia dei Bolo Sgreeners.",
};

export default async function PlayersPage() {
  const players = await getPlayers();
  if (players.length === 0) return <EmptyState title="Nessun giocatore">I giocatori appariranno qui dopo il primo import.</EmptyState>;
  const sorted = [...players].sort((a, b) => (b.career?.games ?? 0) - (a.career?.games ?? 0) || a.last_name.localeCompare(b.last_name));
  return (
    <div>
      <PageHeader eyebrow="Tutti i tempi" title="Giocatori">
        {players.length} giocatori hanno vestito la maglia dei Bolo Sgreeners.
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((p) => (
          <PlayerCard
            key={p.id}
            slug={p.slug}
            firstName={p.first_name}
            lastName={p.last_name}
            nickname={p.nickname}
            photoPath={p.photo_path}
            meta={[p.seasons.length ? `${p.seasons.length} ${p.seasons.length === 1 ? "stagione" : "stagioni"}` : null, p.career ? `${p.career.games} presenze` : null].filter(Boolean).join(" · ")}
          />
        ))}
      </div>
    </div>
  );
}
