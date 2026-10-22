/** Sezioni della pagina giocatore: andamento, ultime partite, rendimento per contesto, MVP. */
import Link from "next/link";
import type { PlayerGameLine } from "@/lib/data/matches";
import type { MatchView } from "@/lib/data/players";
import { formatDate, formatNumber } from "@/lib/domain/format";
import { contextSplits } from "@/lib/domain/player";
import { ResultBadge } from "./match";
import { cx } from "./ui";

const pctText = (v: number | null) => (v === null ? "–" : `${formatNumber(v * 100, 0)}%`);

/** Punti partita per partita nella stagione (in ordine di data) con la media. */
export function PointsTrend({ lines, season }: { lines: PlayerGameLine[]; season: string }) {
  const games = lines
    .filter((l) => l.participation === "played" && l.points !== null && l.season_slug === season)
    .sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? ""));
  if (games.length < 3) return null;
  const W = 640;
  const H = 180;
  const pad = { l: 28, r: 12, t: 16, b: 22 };
  const max = Math.max(10, ...games.map((g) => g.points!));
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (games.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const avg = games.reduce((a, g) => a + g.points!, 0) / games.length;
  const path = games.map((g, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(g.points!).toFixed(1)}`).join(" ");
  const area = `${path} L${x(games.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  return (
    <figure className="card p-4">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="eyebrow text-secondary">Punti partita per partita · {season}</span>
        <span className="text-sm text-muted">
          media <span className="display text-xl text-text">{formatNumber(avg, 1)}</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Punti nelle ${games.length} partite della stagione ${season}`}>
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--sg-primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--sg-primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trend-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--sg-primary)" />
            <stop offset="50%" stopColor="var(--sg-secondary)" />
            <stop offset="100%" stopColor="var(--sg-accent)" />
          </linearGradient>
        </defs>
        {[0, Math.round(max / 2), max].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--sg-border)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--sg-muted)">
              {v}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(avg)} y2={y(avg)} stroke="var(--sg-secondary)" strokeDasharray="4 4" strokeWidth="1" opacity="0.7" />
        <path d={area} fill="url(#trend-fill)" />
        <path d={path} fill="none" stroke="url(#trend-line)" strokeWidth="2.5" strokeLinejoin="round" />
        {games.map((g, i) => (
          <circle key={g.id} cx={x(i)} cy={y(g.points!)} r="3.5" fill={g.own_result === "W" ? "var(--sg-win)" : "var(--sg-loss)"}>
            <title>{`${formatDate(g.match_date)} vs ${g.opponent_name}: ${g.points} punti`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-xs text-muted">Pallini verdi: vittorie · rossi: sconfitte</p>
    </figure>
  );
}

/** Ultime 5 partite giocate. */
export function RecentForm({ lines }: { lines: PlayerGameLine[] }) {
  const last = lines
    .filter((l) => l.participation === "played")
    .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""))
    .slice(0, 5);
  if (last.length === 0) return null;
  return (
    <div className="grid grid-cols-5 gap-2">
      {last.map((l) => (
        <Link key={l.id} href={`/partite/${l.match_id}`} className="card flex flex-col items-center gap-1 px-1 py-3 text-center hover:border-primary/40">
          <ResultBadge result={l.own_result} />
          <span className="display text-3xl leading-none">{l.points ?? "–"}</span>
          <span className="text-[0.6rem] uppercase tracking-wide text-muted">punti</span>
          <span className="w-full truncate px-1 text-[0.7rem] text-muted">{l.opponent_name}</span>
        </Link>
      ))}
    </div>
  );
}

/** Rendimento diviso per contesto (casa/trasferta, vittorie/sconfitte, fase). */
export function ContextSplits({ lines }: { lines: PlayerGameLine[] }) {
  const splits = contextSplits(lines);
  if (splits.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="stat-table">
        <thead>
          <tr>
            <th>Contesto</th>
            <th>PG</th>
            <th>PTS</th>
            <th>RIM</th>
            <th>AST</th>
            <th>TIRO</th>
            <th>3P</th>
            <th>TL</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((s, i) => (
            <tr key={s.key} className={cx(i > 0 && splits[i - 1].group !== s.group && "[&>td]:border-t [&>td]:border-t-border")}>
              <td>
                <span className="block text-[0.6rem] uppercase tracking-wider text-muted">{s.group}</span>
                <span className="font-semibold">{s.label}</span>
              </td>
              <td className="tabular-nums">{s.summary.games}</td>
              <td className="font-semibold tabular-nums">{formatNumber(s.summary.ppg, 1)}</td>
              <td className="tabular-nums">{formatNumber(s.summary.rpg, 1)}</td>
              <td className="tabular-nums">{formatNumber(s.summary.apg, 1)}</td>
              <td className="tabular-nums">{pctText(s.summary.fgPct)}</td>
              <td className="tabular-nums">{pctText(s.summary.fg3Pct)}</td>
              <td className="tabular-nums">{pctText(s.summary.ftPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-4 text-xs text-muted sm:px-0">Valori a partita; percentuali su tutti i tiri del contesto.</p>
    </div>
  );
}

/** Partite in cui il giocatore è stato MVP. */
export function MvpList({ matches, lines }: { matches: MatchView[]; lines: PlayerGameLine[] }) {
  if (matches.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {matches.map((m) => {
        const line = lines.find((l) => l.match_id === m.id);
        return (
          <Link key={m.id} href={`/partite/${m.id}`} className="glow-panel flex items-center gap-4 rounded-2xl border border-border p-4 hover:border-gold/60">
            <span className="accent-serif text-gold-gradient text-4xl leading-none">MVP</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">vs {m.opponent_name}</span>
              <span className="block text-xs text-text/70">
                {formatDate(m.match_date)} · {m.own_score}-{m.opponent_score}
              </span>
            </span>
            {line?.points !== null && line?.points !== undefined && (
              <span className="text-right">
                <span className="display block text-3xl leading-none">{line.points}</span>
                <span className="text-[0.6rem] uppercase tracking-wide text-text/70">punti</span>
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
