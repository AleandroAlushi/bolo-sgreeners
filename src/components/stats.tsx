/** Tabelle statistiche: box score, confronto squadre, totali giocatore, leaderboard. */
import Link from "next/link";
import type { PlayerGameLine, TeamMatchStats } from "@/lib/data/matches";
import { formatMadeAttempted, formatNumber, formatPct, formatSigned, ratio } from "@/lib/domain/format";
import { buildLeaderboard, thresholdLabel, type StatDefinition, type TotalsRow } from "@/lib/domain/stats";
import { PlayerAvatar } from "./player";
import { Card, cx } from "./ui";

type NumLike = number | null | undefined;
type LineLike = Pick<PlayerGameLine, "minutes" | "points" | "fgm" | "fga" | "fg2m" | "fg2a" | "fg3m" | "fg3a" | "ftm" | "fta" | "oreb" | "dreb" | "reb" | "ast" | "stl" | "tov" | "blk" | "pf" | "plus_minus">;

interface Column {
  key: string;
  label: string;
  title: string;
  value: (l: Partial<LineLike>) => NumLike;
  render: (l: Partial<LineLike>) => string;
}

const pairCol = (key: string, label: string, title: string, m: keyof LineLike, a: keyof LineLike): Column => ({
  key,
  label,
  title,
  value: (l) => l[a] as NumLike,
  render: (l) => formatMadeAttempted(l[m] as NumLike, l[a] as NumLike),
});
const numCol = (key: keyof LineLike, label: string, title: string, signed = false): Column => ({
  key,
  label,
  title,
  value: (l) => l[key] as NumLike,
  render: (l) => (signed ? formatSigned(l[key] as NumLike) : formatNumber(l[key] as NumLike, Number.isInteger(l[key] ?? 0) ? 0 : 1)),
});

const BOX_COLUMNS: Column[] = [
  numCol("minutes", "MIN", "Minuti"),
  numCol("points", "PTS", "Punti"),
  pairCol("fg", "TIRI", "Tiri dal campo (realizzati/tentati)", "fgm", "fga"),
  pairCol("fg2", "2P", "Tiri da 2", "fg2m", "fg2a"),
  pairCol("fg3", "3P", "Tiri da 3", "fg3m", "fg3a"),
  pairCol("ft", "TL", "Tiri liberi", "ftm", "fta"),
  numCol("oreb", "RO", "Rimbalzi offensivi"),
  numCol("dreb", "RD", "Rimbalzi difensivi"),
  numCol("reb", "RT", "Rimbalzi totali"),
  numCol("ast", "AST", "Assist"),
  numCol("stl", "REC", "Palle recuperate"),
  numCol("tov", "PP", "Palle perse"),
  numCol("blk", "STP", "Stoppate"),
  numCol("pf", "F", "Falli"),
  numCol("plus_minus", "+/-", "Plus/minus", true),
];

function sumLines(lines: Partial<LineLike>[]): Partial<LineLike> {
  const out: Record<string, number | null> = {};
  for (const k of ["minutes", "points", "fgm", "fga", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "tov", "blk", "pf"] as const) {
    const vals = lines.map((l) => l[k]).filter((v): v is number => typeof v === "number");
    out[k] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }
  return out as Partial<LineLike>;
}

export function BoxScore({ lines, teamTotals }: { lines: PlayerGameLine[]; teamTotals?: TeamMatchStats | null }) {
  const played = lines.filter((l) => l.participation === "played");
  const dnp = lines.filter((l) => l.participation === "dnp");
  const columns = BOX_COLUMNS.filter((c) => played.some((l) => c.value(l) !== null && c.value(l) !== undefined));
  const totals: Partial<LineLike> = teamTotals
    ? { ...teamTotals, fg2m: teamTotals.fgm !== null && teamTotals.fg3m !== null ? teamTotals.fgm - teamTotals.fg3m : null, fg2a: teamTotals.fga !== null && teamTotals.fg3a !== null ? teamTotals.fga - teamTotals.fg3a : null, minutes: null, plus_minus: null }
    : { ...sumLines(played), minutes: null };

  return (
    <div>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Giocatore</th>
              {columns.map((c) => (
                <th key={c.key} title={c.title}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {played.map((l) => (
              <tr key={l.id}>
                <td className="max-w-[11rem]">
                  {l.player_slug ? (
                    <Link href={`/giocatori/${l.player_slug}`} className="flex items-center gap-2 hover:text-primary">
                      <span className="w-6 text-right text-xs text-muted tabular-nums">{l.jersey_number ?? ""}</span>
                      <span className="truncate font-semibold">{l.player_name}</span>
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-muted" title="Riga non attribuita a un giocatore">
                      <span className="w-6" />
                      <span className="truncate italic">{l.raw_name} (n.a.)</span>
                    </span>
                  )}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className={cx("tabular-nums", c.key === "points" && "font-bold text-text")}>
                    {c.render(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Totale squadra</td>
              {columns.map((c) => (
                <td key={c.key} className="tabular-nums">
                  {c.key === "minutes" || c.key === "plus_minus" ? "" : c.render(totals)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {dnp.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Non entrati: {dnp.map((l) => l.player_name ?? l.raw_name).join(", ")}
        </p>
      )}
    </div>
  );
}

/** Confronto statistiche di squadra (barre). */
export function TeamComparison({ own, opponent, ownName, opponentName }: { own: TeamMatchStats; opponent: TeamMatchStats; ownName: string; opponentName: string }) {
  const all: { label: string; a: NumLike; b: NumLike; text?: (s: TeamMatchStats) => string }[] = [
    { label: "Tiri dal campo", a: ratio(own.fgm, own.fga), b: ratio(opponent.fgm, opponent.fga), text: (s) => `${formatMadeAttempted(s.fgm, s.fga)} · ${formatPct(ratio(s.fgm, s.fga), 0)}` },
    { label: "Tiri da 3", a: ratio(own.fg3m, own.fg3a), b: ratio(opponent.fg3m, opponent.fg3a), text: (s) => `${formatMadeAttempted(s.fg3m, s.fg3a)} · ${formatPct(ratio(s.fg3m, s.fg3a), 0)}` },
    { label: "Tiri liberi", a: ratio(own.ftm, own.fta), b: ratio(opponent.ftm, opponent.fta), text: (s) => `${formatMadeAttempted(s.ftm, s.fta)} · ${formatPct(ratio(s.ftm, s.fta), 0)}` },
    { label: "Rimbalzi", a: own.reb, b: opponent.reb },
    { label: "Rimbalzi offensivi", a: own.oreb, b: opponent.oreb },
    { label: "Assist", a: own.ast, b: opponent.ast },
    { label: "Palle recuperate", a: own.stl, b: opponent.stl },
    { label: "Palle perse", a: own.tov, b: opponent.tov },
    { label: "Stoppate", a: own.blk, b: opponent.blk },
    { label: "Falli", a: own.pf, b: opponent.pf },
  ];
  // Nei box score Easy Stats assist e recuperi degli avversari quasi mai vengono registrati:
  // uno 0 avversario in queste voci non è confrontabile e la riga viene omessa.
  const untrackedForOpponent = new Set(["Assist", "Palle recuperate"]);
  const rows = all.filter(
    (r) => r.a !== null && r.a !== undefined && r.b !== null && r.b !== undefined && !(untrackedForOpponent.has(r.label) && r.b === 0),
  );
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-wide">
        <span className="text-primary">{ownName}</span>
        <span className="text-muted">{opponentName}</span>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const a = r.a ?? 0;
          const b = r.b ?? 0;
          const share = a + b === 0 ? 50 : (a / (a + b)) * 100;
          return (
            <li key={r.label}>
              <div className="mb-1 flex justify-between gap-2 text-sm tabular-nums">
                <span className="font-semibold">{r.text ? r.text(own) : formatNumber(r.a)}</span>
                <span className="text-xs text-muted">{r.label}</span>
                <span className="text-muted">{r.text ? r.text(opponent) : formatNumber(r.b)}</span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="bg-primary" style={{ width: `${share}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface PlayerRef {
  id: string;
  slug: string;
  display_name: string;
  photo_path?: string | null;
}

export function Leaderboard({ def, rows, players, limit = 5 }: { def: StatDefinition; rows: TotalsRow[]; players: PlayerRef[]; limit?: number }) {
  const entries = buildLeaderboard(def, rows, limit);
  const threshold = thresholdLabel(def);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="display text-lg">{def.label}</h3>
        <span className="text-xs font-semibold text-muted">{def.short_label}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Dati non sufficienti.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => {
            const p = players.find((x) => x.id === e.playerId);
            if (!p) return null;
            return (
              <li key={e.playerId} className="flex items-center gap-3">
                <span className={cx("display w-5 text-center text-lg", e.rank === 1 ? "text-primary" : "text-muted")}>{e.rank}</span>
                <PlayerAvatar name={p.display_name} photoPath={p.photo_path} size={30} />
                <Link href={`/giocatori/${p.slug}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-primary">
                  {p.display_name}
                </Link>
                <span className="text-right">
                  <span className={cx("display text-xl tabular-nums", e.rank === 1 && "text-primary")}>{e.display}</span>
                  {e.detail && <span className="block text-[0.65rem] leading-none text-muted">{e.detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {threshold && <p className="mt-3 text-[0.7rem] text-muted">{threshold}</p>}
    </Card>
  );
}

type TotalsLike = TotalsRow & { label?: string; href?: string | null; sublabel?: string | null };

const avg = (row: TotalsRow, col: string) => {
  const total = row[col];
  const games = row[`${col}_games`];
  return typeof total === "number" && typeof games === "number" && games > 0 ? total / games : null;
};
const num = (row: TotalsRow, col: string) => (typeof row[col] === "number" ? (row[col] as number) : null);

/** Tabella dei totali e delle medie (per stagione, fase o carriera). */
export function TotalsTable({ rows, firstHeader, totalRow }: { rows: TotalsLike[]; firstHeader: string; totalRow?: TotalsLike | null }) {
  const cols: { label: string; title: string; render: (r: TotalsRow) => string; present: (r: TotalsRow) => boolean; strong?: boolean }[] = [
    { label: "PG", title: "Partite giocate", render: (r) => formatNumber(num(r, "games")), present: () => true },
    { label: "MIN", title: "Minuti a partita", render: (r) => formatNumber(avg(r, "minutes"), 1), present: (r) => avg(r, "minutes") !== null },
    { label: "PTS", title: "Punti totali", render: (r) => formatNumber(num(r, "points")), present: (r) => num(r, "points") !== null, strong: true },
    { label: "PPG", title: "Media punti", render: (r) => formatNumber(avg(r, "points"), 1), present: (r) => avg(r, "points") !== null, strong: true },
    { label: "RT", title: "Rimbalzi totali", render: (r) => formatNumber(num(r, "reb")), present: (r) => num(r, "reb") !== null },
    { label: "RPG", title: "Media rimbalzi", render: (r) => formatNumber(avg(r, "reb"), 1), present: (r) => avg(r, "reb") !== null },
    { label: "AST", title: "Assist", render: (r) => formatNumber(num(r, "ast")), present: (r) => num(r, "ast") !== null },
    { label: "APG", title: "Media assist", render: (r) => formatNumber(avg(r, "ast"), 1), present: (r) => avg(r, "ast") !== null },
    { label: "REC", title: "Palle recuperate", render: (r) => formatNumber(num(r, "stl")), present: (r) => num(r, "stl") !== null },
    { label: "PP", title: "Palle perse", render: (r) => formatNumber(num(r, "tov")), present: (r) => num(r, "tov") !== null },
    { label: "STP", title: "Stoppate", render: (r) => formatNumber(num(r, "blk")), present: (r) => num(r, "blk") !== null },
    { label: "F", title: "Falli", render: (r) => formatNumber(num(r, "pf")), present: (r) => num(r, "pf") !== null },
    { label: "TIRI%", title: "% tiri dal campo", render: (r) => formatPct(ratio(num(r, "fgm"), num(r, "fga"))), present: (r) => num(r, "fga") !== null },
    { label: "3P", title: "Triple realizzate/tentate", render: (r) => formatMadeAttempted(num(r, "fg3m"), num(r, "fg3a")), present: (r) => num(r, "fg3a") !== null },
    { label: "3P%", title: "% da 3", render: (r) => formatPct(ratio(num(r, "fg3m"), num(r, "fg3a"))), present: (r) => num(r, "fg3a") !== null },
    { label: "TL%", title: "% tiri liberi", render: (r) => formatPct(ratio(num(r, "ftm"), num(r, "fta"))), present: (r) => num(r, "fta") !== null },
    { label: "+/-", title: "Plus/minus", render: (r) => formatSigned(num(r, "plus_minus")), present: (r) => (num(r, "plus_minus_games") ?? 0) > 0 },
  ];
  const visible = cols.filter((c) => rows.some(c.present));
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="stat-table">
        <thead>
          <tr>
            <th>{firstHeader}</th>
            {visible.map((c) => (
              <th key={c.label} title={c.title}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.label}-${i}`}>
              <td className="max-w-[12rem]">
                {r.href ? (
                  <Link href={r.href} className="block truncate font-semibold hover:text-primary">
                    {r.label}
                  </Link>
                ) : (
                  <span className="block truncate font-semibold">{r.label}</span>
                )}
                {r.sublabel && <span className="block truncate text-[0.7rem] text-muted">{r.sublabel}</span>}
              </td>
              {visible.map((c) => (
                <td key={c.label} className={cx("tabular-nums", c.strong && "font-semibold text-text")}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totalRow && (
          <tfoot>
            <tr>
              <td>{totalRow.label}</td>
              {visible.map((c) => (
                <td key={c.label} className="tabular-nums">
                  {c.render(totalRow)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Log partita per partita di un giocatore. */
export function GameLog({ lines }: { lines: PlayerGameLine[] }) {
  const played = lines.filter((l) => l.participation === "played");
  const columns = BOX_COLUMNS.filter((c) => played.some((l) => c.value(l) !== null && c.value(l) !== undefined));
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="stat-table">
        <thead>
          <tr>
            <th>Partita</th>
            {columns.map((c) => (
              <th key={c.key} title={c.title}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {played.map((l) => (
            <tr key={l.id}>
              <td className="max-w-[12rem]">
                <Link href={`/partite/${l.match_id}`} className="block hover:text-primary">
                  <span className="block truncate font-semibold">
                    {l.own_side === "away" ? "@ " : "vs "}
                    {l.opponent_name}
                  </span>
                  <span className="block text-[0.7rem] text-muted">
                    {l.match_date ? l.match_date.split("-").reverse().join("/") : "data n.d."} ·{" "}
                    <span className={l.own_result === "W" ? "text-win" : l.own_result === "L" ? "text-loss" : ""}>
                      {l.own_result === "W" ? "V" : l.own_result === "L" ? "S" : ""} {l.own_score}-{l.opponent_score}
                    </span>
                  </span>
                </Link>
              </td>
              {columns.map((c) => (
                <td key={c.key} className={cx("tabular-nums", c.key === "points" && "font-bold text-text")}>
                  {c.render(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
