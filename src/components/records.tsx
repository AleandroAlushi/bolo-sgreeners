"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/domain/format";
import { RECORD_STATS, type RecordEntry, type RecordScope, type TeamGameRecord } from "@/lib/domain/records";
import { cx } from "./ui";

/** Selettore "Di sempre / 2026-27 / …" sopra un gruppo di record. */
function ScopePills({ scopes, current, onPick }: { scopes: RecordScope[]; current: string; onPick: (id: string) => void }) {
  if (scopes.length < 2) return null;
  return (
    <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
      {scopes.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={s.id === current}
          onClick={() => onPick(s.id)}
          className={cx(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
            s.id === current ? "bg-primary text-primary-ink" : "bg-surface-2 text-muted hover:text-text",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

const where = (r: RecordEntry) => `${r.away ? "@" : "vs"} ${r.opponent} · ${formatDate(r.date, "day-month")} ${r.date?.slice(0, 4) ?? ""}`;

/** Career high di un giocatore: di sempre o di una stagione, una card per statistica. */
export function PersonalRecords({ scopes }: { scopes: RecordScope[] }) {
  const [current, setCurrent] = useState(scopes[0]?.id ?? "sempre");
  const scope = scopes.find((s) => s.id === current) ?? scopes[0];
  if (!scope) return null;
  return (
    <div>
      <ScopePills scopes={scopes} current={scope.id} onPick={setCurrent} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {RECORD_STATS.map(({ key, label }) => {
          const r = scope.records[key][0];
          return (
            <div key={key} className="card px-4 py-3">
              <p className="eyebrow text-[0.62rem] text-muted">{label}</p>
              {r ? (
                <>
                  <p className="display mt-1 text-[2.6rem] leading-none tabular-nums text-primary">{r.value}</p>
                  <Link href={`/partite/${r.matchId}`} className="mt-1 block text-xs text-muted hover:text-text">
                    {where(r)}
                  </Link>
                  {r.ties > 0 && <p className="text-[0.68rem] text-secondary">eguagliato {r.ties === 1 ? "un'altra volta" : `altre ${r.ties} volte`}</p>}
                </>
              ) : (
                <p className="display mt-1 text-[2.6rem] leading-none text-muted">–</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Record di squadra: le 3 migliori prestazioni individuali per statistica, più i record delle partite. */
export function TeamRecords({ scopes, games }: { scopes: RecordScope[]; games?: Record<string, TeamGameRecord[]> }) {
  const [current, setCurrent] = useState(scopes[0]?.id ?? "sempre");
  const scope = scopes.find((s) => s.id === current) ?? scopes[0];
  if (!scope) return null;
  const gameRecords = games?.[scope.id] ?? [];
  return (
    <div>
      <ScopePills scopes={scopes} current={scope.id} onPick={setCurrent} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RECORD_STATS.map(({ key, label }) => {
          const top = scope.records[key];
          if (top.length === 0) return null;
          return (
            <div key={key} className="card p-4">
              <p className="eyebrow text-[0.62rem] text-muted">{label} in una partita</p>
              <ol className="mt-2 space-y-2">
                {top.map((r, i) => (
                  <li key={`${r.matchId}-${r.playerSlug}`} className="flex items-baseline gap-3">
                    <span className={cx("display w-12 shrink-0 text-right tabular-nums", i === 0 ? "text-3xl text-primary" : "text-2xl text-text/80")}>{r.value}</span>
                    <span className="min-w-0">
                      {r.playerSlug ? (
                        <Link href={`/giocatori/${r.playerSlug}`} className="block truncate text-sm font-semibold hover:text-primary">
                          {r.playerName}
                        </Link>
                      ) : (
                        <span className="block truncate text-sm font-semibold">{r.playerName}</span>
                      )}
                      <Link href={`/partite/${r.matchId}`} className="block truncate text-xs text-muted hover:text-text">
                        {where(r)}
                      </Link>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
        {gameRecords.length > 0 && (
          <div className="card p-4">
            <p className="eyebrow text-[0.62rem] text-muted">Partite</p>
            <ul className="mt-2 space-y-2">
              {gameRecords.map((g) => (
                <li key={g.label} className="flex items-baseline gap-3">
                  <span className="display w-12 shrink-0 text-right text-2xl tabular-nums text-secondary">{g.value}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{g.label}</span>
                    <Link href={`/partite/${g.matchId}`} className="block truncate text-xs text-muted hover:text-text">
                      {g.detail}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
