import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconLock } from "@/components/icons";
import { LoadingBlock } from "@/components/loading";
import { Notice } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/domain/format";
import { deleteLiveGame, startLiveGame } from "@/lib/live/actions";
import { requireTeamSession } from "@/lib/team/auth";

export const metadata: Metadata = { title: "Statistiche live", robots: { index: false } };

const ERRORS: Record<string, string> = {
  dati: "Dati non validi: riprova.",
  convocati: "Servono almeno 5 convocati.",
  avvio: "Non è stato possibile avviare la partita: riprova.",
};

async function LiveHome({ searchParams }: { searchParams: Promise<{ errore?: string; partita?: string }> }) {
  const session = await requireTeamSession();
  const { errore, partita } = await searchParams;
  if (!session.isMember) return <Notice tone="warning">Questo account non è abilitato all&apos;area squadra.</Notice>;
  const { supabase } = session;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const day = (offset: number) => new Date(now.getTime() + offset * 86400_000).toISOString().slice(0, 10);
  const from = day(-3);
  const to = day(10);
  const [{ data: matches }, { data: games }] = await Promise.all([
    supabase
      .from("v_matches")
      .select("id, season_id, match_date, start_time, opponent_name, own_side, venue_name, competition_name, round_label, has_box_score")
      .eq("involves_own_team", true)
      .gte("match_date", from)
      .lte("match_date", to)
      .order("match_date"),
    supabase.from("live_games").select("id, match_id, status, period, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const list = matches ?? [];
  // partita proposta: quella scelta, oppure la prima da oggi in poi
  const selected = list.find((m) => m.id === partita) ?? list.find((m) => (m.match_date ?? "") >= today) ?? list.at(-1);
  const { data: roster } = selected
    ? await supabase
        .from("v_season_roster")
        .select("player_id, first_name, last_name, nickname, jersey_number, is_active")
        .eq("season_id", selected.season_id!)
        .order("jersey_number")
    : { data: [] };
  const open = (games ?? []).filter((g) => g.status !== "saved");
  const label = (id: string | null) => {
    const m = list.find((x) => x.id === id);
    return m ? `${m.own_side === "home" ? "vs" : "@"} ${m.opponent_name} · ${formatDate(m.match_date, "day-month")}` : "Partita";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="eyebrow flex items-center gap-1.5 text-secondary">
          <IconLock size={14} /> Area squadra
        </p>
        <h1 className="display mt-1 text-5xl leading-none">Statistiche live</h1>
        <p className="mt-2 text-sm text-muted">
          Prendi le statistiche dal telefono o dal tablet durante la partita: il punteggio, il tabellino e l&apos;andamento si vedono in
          diretta nella pagina della partita. A fine partita salvi il box score, come quando si carica il file di Easy Stats.
        </p>
      </header>

      {errore && ERRORS[errore] && <Notice tone="warning">{ERRORS[errore]}</Notice>}

      {open.length > 0 && (
        <section className="space-y-2">
          <h2 className="display text-2xl">In corso</h2>
          {open.map((g) => (
            <div key={g.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{label(g.match_id)}</p>
                <p className="text-xs text-muted">{g.status === "live" ? `In diretta · ${g.period}° periodo` : "Finita, box score da salvare"}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/area-squadra/live/${g.id}`} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
                  Riprendi
                </Link>
                {session.isAdmin && (
                  <form action={deleteLiveGame}>
                    <input type="hidden" name="id" value={g.id} />
                    <button className="text-xs font-semibold text-loss hover:underline">Elimina</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="display text-2xl">Nuova partita</h2>
        {list.length === 0 ? (
          <Notice>Nessuna partita dei Bolo Sgreeners tra 3 giorni fa e i prossimi 10 giorni.</Notice>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {list.map((m) => (
                <Link
                  key={m.id}
                  href={`/area-squadra/live?partita=${m.id}`}
                  className={
                    m.id === selected?.id
                      ? "rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-ink"
                      : "rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
                  }
                >
                  {label(m.id)}
                </Link>
              ))}
            </div>
            {selected && (
              <form action={startLiveGame} className="card space-y-5 p-4 sm:p-5">
                <input type="hidden" name="match_id" value={selected.id!} />
                <div>
                  <p className="display text-2xl leading-none">
                    {selected.own_side === "home" ? "vs" : "@"} {selected.opponent_name}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {[selected.competition_name, selected.round_label, formatDate(selected.match_date, "long"), selected.start_time ? formatTime(selected.start_time) : null, selected.venue_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {selected.has_box_score && (
                    <p className="mt-2 text-xs text-secondary">Questa partita ha già un box score: salvando la diretta verrà sostituito.</p>
                  )}
                </div>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Convocati</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(roster ?? []).map((r) => (
                      <label key={r.player_id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm has-[:checked]:border-primary/60 has-[:checked]:bg-primary/[0.06]">
                        <input type="checkbox" name="player" value={r.player_id ?? ""} defaultChecked={r.is_active ?? true} className="accent-[var(--sg-primary)]" />
                        <span className="display w-7 text-lg leading-none text-secondary">{r.jersey_number ?? "–"}</span>
                        <span className="truncate">{r.nickname || r.first_name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    Periodi
                    <select name="periods" defaultValue="4" className="rounded-lg border border-border bg-surface px-2 py-1">
                      <option value="4">4 quarti</option>
                      <option value="2">2 tempi</option>
                      <option value="1">1 periodo</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    Minuti per periodo
                    <input name="period_minutes" type="number" min={1} max={30} defaultValue={10} className="w-16 rounded-lg border border-border bg-surface px-2 py-1" />
                  </label>
                </div>
                <button className="w-full rounded-full bg-primary px-4 py-3 text-base font-semibold text-primary-ink">Inizia la diretta</button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function LivePage(props: PageProps<"/area-squadra/live">) {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <LiveHome searchParams={props.searchParams} />
    </Suspense>
  );
}
