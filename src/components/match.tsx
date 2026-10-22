/** Componenti per partite: badge squadra/risultato, righe calendario, card, parziali. */
import Link from "next/link";
import type { MatchView, PeriodScore } from "@/lib/data/matches";
import { formatDate, formatTime } from "@/lib/domain/format";
import { IconClock, IconPin } from "./icons";
import { Badge, cx } from "./ui";

const STOP = new Set(["csi", "basket", "basketball", "the", "di", "la", "le", "il", "e", "snc", "bar", "a"]);

function initials(name: string) {
  const words = name
    .replace(/.*\s[-/]\s/, "") // "Sponsor - Nome squadra" → "Nome squadra"
    .split(/[\s/]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

function hue(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function TeamBadge({ name, slug, own, size = 40 }: { name: string; slug?: string | null; own?: boolean | null; size?: number }) {
  const style = own
    ? { width: size, height: size, background: "var(--sg-bg)", boxShadow: "inset 0 0 0 2px var(--sg-primary)", color: "var(--sg-primary)" }
    : { width: size, height: size, background: `hsl(${hue(slug ?? name)} 35% 20%)`, color: `hsl(${hue(slug ?? name)} 70% 78%)` };
  return (
    <span
      aria-hidden
      className="display inline-flex shrink-0 items-center justify-center rounded-full font-extrabold italic"
      style={{ ...style, fontSize: size * 0.4 }}
    >
      {own ? "BS" : initials(name)}
    </span>
  );
}

export function ResultBadge({ result }: { result: string | null | undefined }) {
  if (result === "W") return <Badge tone="win">V</Badge>;
  if (result === "L") return <Badge tone="loss">S</Badge>;
  return null;
}

function roundText(m: MatchView) {
  if (m.round_label) return m.round_label;
  if (m.round_number) return `${m.round_number}ª giornata`;
  return null;
}

export function matchSubtitle(m: MatchView) {
  return [m.competition_short_name ?? m.competition_name, roundText(m)].filter(Boolean).join(" · ");
}

/** Riga compatta del calendario. */
export function MatchRow({ match: m, showPhase = true }: { match: MatchView; showPhase?: boolean }) {
  const own = m.involves_own_team;
  const date = m.match_date ? formatDate(m.match_date, "day-month") : "n.d.";
  const played = m.status === "played" || m.status === "forfeit";
  return (
    <Link
      href={`/partite/${m.id}`}
      className={cx(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2",
        own && "bg-primary/[0.04] ring-1 ring-primary/15",
      )}
    >
      <div className="w-12 shrink-0 text-center">
        <p className="display text-lg font-bold leading-none">{date.split(" ")[0]}</p>
        <p className="text-[0.65rem] uppercase tracking-wide text-muted">{date.split(" ")[1] ?? ""}</p>
      </div>
      <div className="min-w-0 flex-1">
        {own ? (
          <p className="truncate font-semibold">
            <span className="text-muted">{m.own_side === "home" ? "vs" : m.own_side === "away" ? "@" : "vs"}</span>{" "}
            {m.opponent_name}
          </p>
        ) : (
          <p className="truncate font-semibold">
            {m.home_team_name} <span className="text-muted">–</span> {m.away_team_name}
          </p>
        )}
        <p className="truncate text-xs text-muted">
          {showPhase && matchSubtitle(m)}
          {own && m.home_away_confirmed && <> · {m.own_side === "home" ? "Casa" : "Trasferta"}</>}
          {m.verification === "to_verify" && <span className="text-warning"> · da verificare</span>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {played ? (
          <div className="flex items-center gap-2">
            <span className="display text-xl font-bold tabular-nums">
              {own ? `${m.own_score}–${m.opponent_score}` : `${m.home_score}–${m.away_score}`}
            </span>
            <ResultBadge result={m.own_result} />
          </div>
        ) : (
          <span className="text-sm text-muted">{m.status === "scheduled" ? (formatTime(m.start_time) ?? "da giocare") : statusLabel(m.status)}</span>
        )}
      </div>
    </Link>
  );
}

export function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "played":
      return "Finale";
    case "scheduled":
      return "In programma";
    case "postponed":
      return "Rinviata";
    case "cancelled":
      return "Annullata";
    case "forfeit":
      return "A tavolino";
    default:
      return "";
  }
}

/** Card grande per ultima/prossima partita. */
export function MatchCard({ match: m, label }: { match: MatchView; label: string }) {
  const played = m.status === "played" || m.status === "forfeit";
  const side = (home: boolean) => ({
    name: home ? m.home_team_name! : m.away_team_name!,
    slug: home ? m.home_team_slug : m.away_team_slug,
    own: home ? m.home_is_own : m.away_is_own,
    score: home ? m.home_score : m.away_score,
  });
  const teams = [side(true), side(false)];
  const winnerHome = played && (m.home_score ?? 0) > (m.away_score ?? 0);
  return (
    <Link href={`/partite/${m.id}`} className="card group block overflow-hidden transition-colors hover:border-primary/40">
      <div className="neon-line h-[3px]" />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-secondary">{label}</p>
          {played ? <ResultBadge result={m.own_result} /> : <Badge tone="secondary">{statusLabel(m.status)}</Badge>}
        </div>
        <div className="space-y-2">
          {teams.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <TeamBadge name={t.name} slug={t.slug} own={t.own} size={36} />
              <p className={cx("min-w-0 flex-1 truncate font-semibold", t.own && "text-primary")}>{t.name}</p>
              {played && (
                <p className={cx("display text-3xl font-extrabold tabular-nums", (i === 0) === winnerHome ? "text-text" : "text-muted")}>{t.score}</p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{formatDate(m.match_date)}</span>
          {m.start_time && (
            <span className="inline-flex items-center gap-1">
              <IconClock size={13} /> {formatTime(m.start_time)}
            </span>
          )}
          {m.venue_name && (
            <span className="inline-flex items-center gap-1">
              <IconPin size={13} /> {m.venue_name}
            </span>
          )}
          <span>{matchSubtitle(m)}</span>
        </div>
      </div>
    </Link>
  );
}

/** Tabella dei punteggi per periodo. */
export function PeriodScores({ match: m, periods }: { match: MatchView; periods: PeriodScore[] }) {
  const maxPeriod = Math.max(0, ...periods.map((p) => p.period));
  if (maxPeriod === 0) return null;
  const labels = Array.from({ length: maxPeriod }, (_, i) => (i < 4 ? `Q${i + 1}` : `OT${i - 3}`));
  const rows = [
    { id: m.home_team_id!, name: m.home_team_name!, own: m.home_is_own, total: m.home_score },
    { id: m.away_team_id!, name: m.away_team_name!, own: m.away_is_own, total: m.away_score },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="stat-table">
        <thead>
          <tr>
            <th>Squadra</th>
            {labels.map((l) => (
              <th key={l}>{l}</th>
            ))}
            <th>Tot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.own ? "is-own" : undefined}>
              <td className="max-w-[10rem] truncate font-semibold">{r.name}</td>
              {labels.map((l, i) => (
                <td key={l} className="tabular-nums">{periods.find((p) => p.team_id === r.id && p.period === i + 1)?.points ?? "–"}</td>
              ))}
              <td className="font-bold tabular-nums">{r.total ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
