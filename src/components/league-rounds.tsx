"use client";

import { useState } from "react";
import type { LeagueResult } from "@/lib/data/matches";
import { formatDate, formatTime } from "@/lib/domain/format";
import { TeamBadge } from "./match";
import { cx } from "./ui";

interface Round {
  key: string;
  label: string;
  matches: LeagueResult[];
}

/** Giornate di una competizione nell'ordine del Livescore (numero, poi data). */
function roundsOf(results: LeagueResult[]): Round[] {
  const out: Round[] = [];
  for (const r of results) {
    const label = r.round_label ?? (r.round_number ? `${r.round_number}ª giornata` : "Altre partite");
    let round = out.find((x) => x.label === label);
    if (!round) out.push((round = { key: label, label, matches: [] }));
    round.matches.push(r);
  }
  for (const round of out)
    round.matches.sort(
      (a, b) => (a.match_date ?? "9999").localeCompare(b.match_date ?? "9999") || (a.start_time ?? "").localeCompare(b.start_time ?? ""),
    );
  return out;
}

const played = (m: LeagueResult) => m.home_score !== null && m.away_score !== null;

/** La giornata da mostrare all'apertura: l'ultima con almeno un risultato, altrimenti la prima. */
function currentRound(rounds: Round[]): number {
  let last = -1;
  rounds.forEach((r, i) => {
    if (r.matches.some(played)) last = i;
  });
  return Math.max(last, 0);
}

/** Sigla breve per i selettori: "1ª giornata" → "1ª", "Quarti · gara 1" → "Quarti 1". */
const chipLabel = (label: string) => label.replace(/\s*giornata$/i, "").replace(" · gara ", " ");

function ResultRow({ m }: { m: LeagueResult }) {
  const done = played(m);
  const own = m.home_is_own || m.away_is_own;
  const teams = [
    { name: m.home_name, isOwn: m.home_is_own, logo: m.home_team_logo, score: m.home_score, won: done && m.home_score! > m.away_score! },
    { name: m.away_name, isOwn: m.away_is_own, logo: m.away_team_logo, score: m.away_score, won: done && m.away_score! > m.home_score! },
  ];
  // tabellone: una riga per squadra, punteggio a destra (i nomi lunghi hanno tutta la larghezza)
  return (
    <li className={cx("rounded-xl px-3 py-2.5", own ? "bg-primary/[0.07] ring-1 ring-primary/30" : "bg-surface-2/40")}>
      <div className="space-y-1.5">
        {teams.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <TeamBadge name={t.name ?? "?"} own={t.isOwn} logo={t.logo} size={26} />
            <span
              className={cx(
                "min-w-0 flex-1 truncate text-sm",
                t.isOwn ? "font-bold text-primary" : t.won ? "font-semibold text-text" : "text-text/75",
              )}
            >
              {t.name}
            </span>
            {done && <span className={cx("display text-xl leading-none tabular-nums", t.won ? "text-text" : "text-text/50")}>{t.score}</span>}
          </div>
        ))}
      </div>
      <p className="mt-1.5 truncate text-[0.7rem] text-muted">
        {[
          m.match_date ? formatDate(m.match_date) : "Data da definire",
          !done && m.start_time ? formatTime(m.start_time) : null,
          !done ? m.venue_name : null,
          done && m.result_approved === false ? "da omologare" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </li>
  );
}

/**
 * Tutte le partite del girone, giornata per giornata (anche tra le altre squadre): per leggere la
 * classifica senza aprire il Livescore. Una scheda per competizione se la stagione ne ha più di una.
 */
export function LeagueRounds({ results, competitions }: { results: LeagueResult[]; competitions: { id: string; name: string }[] }) {
  const comps = competitions.filter((c) => results.some((r) => r.competition_id === c.id));
  // all'apertura la fase più recente con almeno un risultato (o la prima)
  const initialComp = [...comps].reverse().find((c) => results.some((r) => r.competition_id === c.id && played(r))) ?? comps[0];
  const [compId, setCompId] = useState(initialComp?.id);
  const rounds = roundsOf(results.filter((r) => r.competition_id === compId));
  const [picked, setPicked] = useState<{ comp: string | undefined; index: number } | null>(null);
  const index = picked && picked.comp === compId ? picked.index : currentRound(rounds);
  const round = rounds[Math.min(index, rounds.length - 1)];
  if (!round) return null;

  return (
    <div className="space-y-3">
      {comps.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex min-w-max rounded-full border border-border bg-surface p-1">
            {comps.map((c) => (
              <button
                key={c.id}
                onClick={() => setCompId(c.id)}
                aria-pressed={c.id === compId}
                className={cx("rounded-full px-3 py-1 text-sm font-semibold", c.id === compId ? "bg-primary text-primary-ink" : "text-muted")}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setPicked({ comp: compId, index: Math.max(0, index - 1) })}
            disabled={index === 0}
            aria-label="Giornata precedente"
            className="press grid size-9 place-items-center rounded-full border border-border text-lg disabled:opacity-30"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="display text-2xl leading-none">{round.label}</p>
            <p className="text-xs text-muted">
              {round.matches.filter(played).length}/{round.matches.length} risultati
            </p>
          </div>
          <button
            onClick={() => setPicked({ comp: compId, index: Math.min(rounds.length - 1, index + 1) })}
            disabled={index >= rounds.length - 1}
            aria-label="Giornata successiva"
            className="press grid size-9 place-items-center rounded-full border border-border text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <div className="-mx-1 mb-3 overflow-x-auto px-1">
          <div className="flex min-w-max gap-1">
            {rounds.map((r, i) => (
              <button
                key={r.key}
                onClick={() => setPicked({ comp: compId, index: i })}
                aria-pressed={i === index}
                title={r.label}
                className={cx(
                  "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                  i === index ? "bg-secondary text-black" : r.matches.every(played) ? "bg-surface-2 text-text/80" : "text-muted",
                )}
              >
                {chipLabel(r.label)}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {round.matches.map((m) => (
            <ResultRow key={m.id} m={m} />
          ))}
        </ul>
      </div>
    </div>
  );
}
