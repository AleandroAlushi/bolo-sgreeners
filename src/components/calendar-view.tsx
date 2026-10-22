"use client";

import { useMemo, useState } from "react";
import type { MatchView } from "@/lib/data/matches";
import { formatMonthYear } from "@/lib/domain/format";
import { MatchRow } from "./match";
import { cx } from "./ui";

type Mode = "fase" | "data";

/** Calendario con raggruppamento per fase/giornata o per mese (scelto lato client). */
export function CalendarView({ matches }: { matches: MatchView[] }) {
  const [mode, setMode] = useState<Mode>("fase");
  const [onlyOwn, setOnlyOwn] = useState(false);
  const hasOthers = matches.some((m) => !m.involves_own_team);
  const visible = onlyOwn ? matches.filter((m) => m.involves_own_team) : matches;

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; subtitle?: string; items: MatchView[] }>();
    const byDate = (a: (typeof visible)[number], b: (typeof visible)[number]) => (a.match_date ?? "9999").localeCompare(b.match_date ?? "9999");
    // per giornata: fase, poi numero di giornata (una gara recuperata resta nella sua giornata), poi data
    const sorted =
      mode === "data"
        ? [...visible].sort(byDate)
        : [...visible].sort((a, b) => (a.phase_order ?? 0) - (b.phase_order ?? 0) || (a.round_number ?? 999) - (b.round_number ?? 999) || byDate(a, b));
    for (const m of sorted) {
      let key: string;
      let title: string;
      let subtitle: string | undefined;
      if (mode === "data") {
        key = m.match_date?.slice(0, 7) ?? "senza-data";
        title = m.match_date ? formatMonthYear(m.match_date) : "Data da fissare";
      } else {
        key = `${m.phase_order}-${m.competition_id}-${m.round_number ?? ""}`;
        title = m.competition_name ?? "";
        subtitle = m.round_label ?? (m.round_number ? `${m.round_number}ª giornata` : m.match_date ? undefined : "Data e giornata da fissare");
      }
      if (!map.has(key)) map.set(key, { title, subtitle, items: [] });
      map.get(key)!.items.push(m);
    }
    return [...map.values()];
  }, [visible, mode]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Raggruppa per" className="inline-flex rounded-full border border-border bg-surface p-1">
          {(["fase", "data"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cx("rounded-full px-3 py-1 text-sm font-semibold", mode === m ? "bg-primary text-primary-ink" : "text-muted")}
            >
              {m === "fase" ? "Per giornata" : "Per data"}
            </button>
          ))}
        </div>
        {hasOthers && (
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={onlyOwn} onChange={(e) => setOnlyOwn(e.target.checked)} className="accent-[var(--sg-primary)]" />
            Solo Bolo Sgreeners
          </label>
        )}
      </div>
      {groups.map((g, i) => {
        const prev = groups[i - 1];
        const showTitle = mode === "data" || !prev || prev.title !== g.title;
        return (
          <section key={`${g.title}-${g.subtitle ?? ""}-${i}`}>
            {showTitle && <h2 className="display mb-2 mt-4 text-2xl">{g.title}</h2>}
            {g.subtitle && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.subtitle}</p>}
            <div className="card divide-y divide-border/60 p-1">
              {g.items.map((m) => (
                <MatchRow key={m.id} match={m} showPhase={mode === "data"} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
