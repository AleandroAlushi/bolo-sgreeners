import Link from "next/link";
import { Notice } from "@/components/ui";
import { refreshPublicSite } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { formatDate, formatTime } from "@/lib/domain/format";
import { romeNow } from "@/lib/push";

/**
 * "Oggi": la pagina d'ingresso dell'area admin (e dell'app Sgreeners Admin), pensata per il giorno
 * della partita: la prossima partita con il pulsante per le statistiche live, la diretta aperta da
 * riprendere, l'ultima partita con le grafiche.
 */
export default async function AdminToday({ searchParams }: PageProps<"/admin">) {
  const { supabase } = await requireAdmin();
  const refreshed = (await searchParams).aggiornato === "1";
  const today = romeNow().date;
  const cols = "id, match_date, start_time, opponent_name, own_side, venue_name, venue_city, competition_name, round_label, status, own_score, opponent_score";
  const [next, last, live, newFeedback] = await Promise.all([
    supabase.from("v_matches").select(cols).eq("involves_own_team", true).gte("match_date", today).eq("status", "scheduled").order("match_date").order("start_time").limit(3),
    supabase.from("v_matches").select(cols).eq("involves_own_team", true).not("own_score", "is", null).order("match_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("live_games").select("id, match_id, status, period, opponent_name").neq("status", "saved").order("created_at", { ascending: false }).limit(3),
    supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const upcoming = next.data ?? [];
  const match = upcoming[0];
  const openLive = live.data ?? [];
  const isToday = match?.match_date === today;
  const vs = (m: { own_side: string | null; opponent_name: string | null }) => `${m.own_side === "away" ? "@" : "vs"} ${m.opponent_name ?? "avversario da definire"}`;
  const lastMatch = last.data;

  return (
    <>
      <h1 className="display text-3xl">Oggi</h1>

      {openLive.map((g) => (
        <Link
          key={g.id}
          href={`/area-squadra/live/${g.id}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-loss/50 bg-loss/10 px-4 py-3 hover:bg-loss/15"
        >
          <span className="flex items-center gap-2 font-semibold text-loss">
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-loss motion-reduce:animate-none" />
            {g.status === "live" ? "Diretta in corso" : "Diretta finita, da salvare"} · {g.opponent_name ?? "partita"} · {g.period}° periodo
          </span>
          <span className="text-sm font-bold text-loss">Riprendi →</span>
        </Link>
      ))}

      {/* prossima partita: il punto di partenza di chi prende le statistiche */}
      <section className="card overflow-hidden">
        <div className="space-y-4 p-5">
          <p className="eyebrow text-secondary">{match ? (isToday ? "Si gioca oggi" : "Prossima partita") : "Prossima partita"}</p>
          {match ? (
            <>
              <div>
                <p className="display text-4xl leading-none sm:text-5xl">{vs(match)}</p>
                <p className="mt-2 text-sm text-muted">
                  {[
                    formatDate(match.match_date, "long"),
                    formatTime(match.start_time),
                    [match.venue_name, match.venue_city].filter(Boolean).join(", ") || null,
                    match.round_label ?? match.competition_name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/area-squadra/live?partita=${match.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-loss px-5 py-3 text-base font-bold text-white shadow-lg shadow-loss/20 hover:bg-loss/90"
                >
                  <span aria-hidden className="size-2.5 rounded-full bg-white" />
                  Inizia le statistiche live
                </Link>
                <Link href="/admin/grafiche" className="inline-flex items-center rounded-full border border-border px-4 py-3 text-sm font-semibold hover:border-primary/50">
                  Grafica di presentazione
                </Link>
                <Link href={`/admin/partite/${match.id}`} className="inline-flex items-center rounded-full border border-border px-4 py-3 text-sm font-semibold hover:border-primary/50">
                  Modifica partita
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              Nessuna partita in calendario. Il calendario arriva dal Livescore CSI; per una partita fuori calendario usa{" "}
              <Link href="/admin/partite/nuova" className="text-primary hover:underline">
                Nuova partita
              </Link>
              .
            </p>
          )}
        </div>
        {upcoming.length > 1 && (
          <ul className="divide-y divide-border border-t border-border text-sm">
            {upcoming.slice(1).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{vs(m)}</span> <span className="text-muted">· {formatDate(m.match_date, "day-month")}{m.start_time ? ` · ${formatTime(m.start_time)}` : ""}</span>
                </span>
                <Link href={`/area-squadra/live?partita=${m.id}`} className="shrink-0 text-xs font-semibold text-loss hover:underline">
                  Live
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lastMatch && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="eyebrow text-muted">Ultima partita</p>
            <p className="display mt-1 text-2xl leading-none">
              {vs(lastMatch)} <span className="tabular-nums text-primary">{lastMatch.own_score}-{lastMatch.opponent_score}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{formatDate(lastMatch.match_date, "long")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/grafiche" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
              Grafiche del dopo partita
            </Link>
            <Link href={`/partite/${lastMatch.id}`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50">
              Pagina della partita
            </Link>
          </div>
        </section>
      )}

      {(newFeedback.count ?? 0) > 0 && (
        <Link href="/admin/feedback" className="block">
          <Notice>
            {newFeedback.count === 1 ? "C'è 1 feedback nuovo" : `Ci sono ${newFeedback.count} feedback nuovi`} da leggere →
          </Notice>
        </Link>
      )}

      <section className="space-y-2">
        <p className="eyebrow text-muted">Scorciatoie</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: "/admin/partite", label: "Partite", hint: "Calendario e risultati" },
            { href: "/admin/giocatori", label: "Giocatori", hint: "Roster, foto, alias" },
            { href: "/admin/area-squadra", label: "Area squadra", hint: "Allenamenti e paste" },
            { href: "/admin/stagioni", label: "Classifiche", hint: "Stagioni e regole" },
          ].map((s) => (
            <Link key={s.href} href={s.href} className="card px-4 py-3 hover:border-primary/40">
              <p className="font-semibold">{s.label}</p>
              <p className="text-xs text-muted">{s.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <form action={refreshPublicSite}>
          <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50">
            Aggiorna il sito pubblico
          </button>
        </form>
        <p className="text-xs text-muted">
          {refreshed ? "Pagine pubbliche aggiornate: i dati nuovi si vedono da subito." : "Serve solo dopo modifiche fatte fuori dall'admin (script, database): le pagine si aggiornano subito invece che entro un'ora."}
        </p>
      </div>
    </>
  );
}
