/** Tabelle statistiche: box score, confronto squadre, totali giocatore, leaderboard. */
import Link from "next/link";
import type { PlayerGameLine, TeamMatchStats } from "@/lib/data/matches";
import { formatMadeAttempted, formatNumber, formatPct, formatSigned, ratio } from "@/lib/domain/format";
import { buildLeaderboard, PER_30_MIN_MINUTES, per30, per30Minutes, thresholdLabel, type StatDefinition, type TotalsRow } from "@/lib/domain/stats";
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

const pctCol = (key: string, label: string, title: string, m: keyof LineLike, a: keyof LineLike): Column => ({
  key,
  label,
  title,
  value: (l) => l[a] as NumLike,
  render: (l) => formatPct(ratio(l[m] as NumLike, l[a] as NumLike)),
});

/**
 * Ordine delle colonne (uguale in partita e nelle statistiche generali): tiri dal campo e %,
 * da 3 e %, liberi e %, rimbalzi offensivi e difensivi, recuperi, stoppate, falli, perse,
 * assist, +/-, minuti, punti. Il totale rimbalzi compare solo dove manca il dettaglio RO/RD.
 */
const BOX_COLUMNS: Column[] = [
  pairCol("fg", "TIRI", "Tiri dal campo (realizzati/tentati)", "fgm", "fga"),
  pctCol("fgp", "TIRI%", "% tiri dal campo", "fgm", "fga"),
  pairCol("fg3", "3P", "Tiri da 3 (realizzati/tentati)", "fg3m", "fg3a"),
  pctCol("fg3p", "3P%", "% tiri da 3", "fg3m", "fg3a"),
  pairCol("ft", "TL", "Tiri liberi (realizzati/tentati)", "ftm", "fta"),
  pctCol("ftp", "TL%", "% tiri liberi", "ftm", "fta"),
  numCol("oreb", "RO", "Rimbalzi offensivi"),
  numCol("dreb", "RD", "Rimbalzi difensivi"),
  numCol("reb", "RT", "Rimbalzi totali"),
  numCol("stl", "REC", "Palle recuperate"),
  numCol("blk", "STP", "Stoppate"),
  numCol("pf", "F", "Falli"),
  numCol("tov", "PP", "Palle perse"),
  numCol("ast", "AST", "Assist"),
  numCol("plus_minus", "+/-", "Plus/minus", true),
  numCol("minutes", "MIN", "Minuti"),
  numCol("points", "PTS", "Punti"),
];

/** Colonne con almeno un valore; il totale rimbalzi solo se mancano offensivi e difensivi. */
function presentColumns(lines: Partial<LineLike>[]): Column[] {
  const has = (c: Column) => lines.some((l) => c.value(l) !== null && c.value(l) !== undefined);
  const split = BOX_COLUMNS.filter((c) => c.key === "oreb" || c.key === "dreb").some(has);
  return BOX_COLUMNS.filter((c) => has(c) && !(c.key === "reb" && split));
}

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
  const columns = presentColumns(played);
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
    // il totale rimbalzi solo se manca il dettaglio offensivi/difensivi
    ...(own.oreb === null && own.dreb === null ? [{ label: "Rimbalzi", a: own.reb, b: opponent.reb }] : []),
    { label: "Rimbalzi offensivi", a: own.oreb, b: opponent.oreb },
    { label: "Rimbalzi difensivi", a: own.dreb, b: opponent.dreb },
    { label: "Palle recuperate", a: own.stl, b: opponent.stl },
    { label: "Stoppate", a: own.blk, b: opponent.blk },
    { label: "Falli", a: own.pf, b: opponent.pf },
    { label: "Palle perse", a: own.tov, b: opponent.tov },
    { label: "Assist", a: own.ast, b: opponent.ast },
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

/** Cognome (o nome intero se è una parola sola): per le schede strette. */
const surname = (name: string) => name.split(" ").slice(1).join(" ") || name;

export function Leaderboard({
  def,
  rows,
  players,
  limit = 5,
  compact,
}: {
  def: StatDefinition;
  rows: TotalsRow[];
  players: PlayerRef[];
  limit?: number;
  /** schede strette (cinque in una riga): solo i cognomi, sul desktop */
  compact?: boolean;
}) {
  const entries = buildLeaderboard(def, rows, limit);
  const threshold = thresholdLabel(def);
  return (
    <Card className={compact ? "p-3.5" : "p-4"}>
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
                <Link href={`/giocatori/${p.slug}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-primary" title={p.display_name}>
                  {compact ? (
                    <>
                      <span className="lg:hidden">{p.display_name}</span>
                      <span className="hidden lg:inline">{surname(p.display_name)}</span>
                    </>
                  ) : (
                    p.display_name
                  )}
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

type StatColumn = { label: string; title: string; render: (r: TotalsRow) => string; present: (r: TotalsRow) => boolean; strong?: boolean };

/** Modo della tabella: totali e medie a partita, oppure valori per 30 minuti. */
export type TotalsMode = "totali" | "per30";

const fgPct: StatColumn = { label: "TIRI%", title: "% tiri dal campo", render: (r) => formatPct(ratio(num(r, "fgm"), num(r, "fga"))), present: (r) => num(r, "fga") !== null };
const fg3Pct: StatColumn = { label: "3P%", title: "% da 3", render: (r) => formatPct(ratio(num(r, "fg3m"), num(r, "fg3a"))), present: (r) => num(r, "fg3a") !== null };
const ftPct: StatColumn = { label: "TL%", title: "% tiri liberi", render: (r) => formatPct(ratio(num(r, "ftm"), num(r, "fta"))), present: (r) => num(r, "fta") !== null };
const pair = (label: string, title: string, m: string, a: string): StatColumn => ({
  label,
  title,
  render: (r) => formatMadeAttempted(num(r, m), num(r, a)),
  present: (r) => num(r, a) !== null,
});
const count = (col: string, label: string, title: string): StatColumn => ({ label, title, render: (r) => formatNumber(num(r, col)), present: (r) => num(r, col) !== null });
/** Il totale rimbalzi compare solo se nessuna riga ha offensivi o difensivi. */
const onlyIfNoSplit = (c: StatColumn, rows: TotalsRow[]) => c.label !== "RT" || !rows.some((r) => num(r, "oreb") !== null || num(r, "dreb") !== null);

const p30 = (col: string, label: string, title: string, strong?: boolean): StatColumn => ({
  label,
  title: `${title} per 30 minuti`,
  render: (r) => {
    const v = per30(r, col);
    const text = formatNumber(v, 1);
    return col === "plus_minus" && v !== null && v > 0 ? `+${text}` : text;
  },
  present: (r) => per30(r, col) !== null,
  strong,
});

/** Colonne per 30 minuti: stesse statistiche della tabella dei totali, normalizzate sui minuti. */
const per30Cols: StatColumn[] = [
  { label: "PG", title: "Partite giocate", render: (r) => formatNumber(num(r, "games")), present: () => true },
  p30("fgm", "TIRI", "Tiri dal campo segnati"),
  fgPct,
  p30("fg3m", "3P", "Triple segnate"),
  fg3Pct,
  p30("ftm", "TL", "Tiri liberi segnati"),
  ftPct,
  p30("oreb", "RO", "Rimbalzi offensivi"),
  p30("dreb", "RD", "Rimbalzi difensivi"),
  p30("reb", "RT", "Rimbalzi"),
  p30("stl", "REC", "Palle recuperate"),
  p30("blk", "STP", "Stoppate"),
  p30("pf", "F", "Falli"),
  p30("tov", "PP", "Palle perse"),
  p30("ast", "AST", "Assist"),
  p30("plus_minus", "+/-", "Plus/minus"),
  { label: "MIN", title: "Minuti totali (partite con i minuti registrati)", render: (r) => formatNumber(num(r, "minutes")), present: (r) => num(r, "minutes") !== null },
  { label: "MPG", title: "Minuti a partita", render: (r) => formatNumber(avg(r, "minutes"), 1), present: (r) => avg(r, "minutes") !== null },
  p30("points", "PTS", "Punti", true),
];

/** Pochi minuti: il valore per 30' esiste ma è poco indicativo. */
const fewMinutes = (r: TotalsRow) => (per30Minutes(r, "points") ?? 0) < PER_30_MIN_MINUTES;

/** Tabella dei totali e delle medie (per stagione, fase o carriera), o dei valori per 30 minuti. */
export function TotalsTable({
  rows,
  firstHeader,
  totalRow,
  mode = "totali",
}: {
  rows: TotalsLike[];
  firstHeader: string;
  totalRow?: TotalsLike | null;
  mode?: TotalsMode;
}) {
  // stesso ordine del box score della partita; in fondo minuti a partita, punti e media punti
  const totalCols: StatColumn[] = [
    { label: "PG", title: "Partite giocate", render: (r) => formatNumber(num(r, "games")), present: () => true },
    pair("TIRI", "Tiri dal campo realizzati/tentati", "fgm", "fga"),
    fgPct,
    pair("3P", "Triple realizzate/tentate", "fg3m", "fg3a"),
    fg3Pct,
    pair("TL", "Tiri liberi realizzati/tentati", "ftm", "fta"),
    ftPct,
    count("oreb", "RO", "Rimbalzi offensivi"),
    count("dreb", "RD", "Rimbalzi difensivi"),
    count("reb", "RT", "Rimbalzi totali"),
    count("stl", "REC", "Palle recuperate"),
    count("blk", "STP", "Stoppate"),
    count("pf", "F", "Falli"),
    count("tov", "PP", "Palle perse"),
    count("ast", "AST", "Assist"),
    { label: "+/-", title: "Plus/minus", render: (r) => formatSigned(num(r, "plus_minus")), present: (r) => (num(r, "plus_minus_games") ?? 0) > 0 },
    { label: "MIN", title: "Minuti a partita", render: (r) => formatNumber(avg(r, "minutes"), 1), present: (r) => avg(r, "minutes") !== null },
    { label: "PTS", title: "Punti totali", render: (r) => formatNumber(num(r, "points")), present: (r) => num(r, "points") !== null, strong: true },
    { label: "PPG", title: "Media punti", render: (r) => formatNumber(avg(r, "points"), 1), present: (r) => avg(r, "points") !== null, strong: true },
  ];
  const cols = mode === "per30" ? per30Cols : totalCols;
  const visible = cols.filter((c) => rows.some(c.present) && onlyIfNoSplit(c, rows));
  const dim = (r: TotalsRow) => mode === "per30" && fewMinutes(r);
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
            <tr
              key={`${r.label}-${i}`}
              className={cx(dim(r) && "text-muted [&_td]:opacity-70")}
              title={dim(r) ? `Meno di ${PER_30_MIN_MINUTES} minuti in campo: valori per 30' poco indicativi` : undefined}
            >
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
  const columns = presentColumns(played);
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
