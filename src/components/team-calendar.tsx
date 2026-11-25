"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { CalEvent, CalKind } from "@/lib/domain/team-calendar";
import { IconChevronRight } from "./icons";
import { cx } from "./ui";

/**
 * Calendario mensile dell'area squadra: si cambia mese con le frecce, i giorni hanno i simboli
 * degli appuntamenti e sotto c'è l'elenco del mese. Toccando un giorno si va al suo appuntamento.
 */

const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];
const WEEKDAY_NAMES = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

const KIND: Record<CalKind, { label: string; bar: string; text: string }> = {
  match: { label: "Partita", bar: "bg-primary", text: "text-primary" },
  training: { label: "Allenamento", bar: "bg-sky", text: "text-sky" },
  paste: { label: "Paste", bar: "bg-accent", text: "text-accent" },
  birthday: { label: "Compleanno", bar: "bg-secondary", text: "text-secondary" },
  break: { label: "Pausa", bar: "bg-muted", text: "text-muted" },
};

const monthKey = (iso: string) => iso.slice(0, 7);
const daysInMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** 0 = lunedì */
const weekdayIndex = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};

export function TeamCalendar({ events, start, end, today }: { events: CalEvent[]; start: string; end: string; today: string }) {
  const first = monthKey(start);
  const last = monthKey(end);
  const initial = today < start ? first : today > end ? last : monthKey(today);
  const [month, setMonth] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  const [y, m] = month.split("-").map(Number);
  const total = daysInMonth(month);
  const lead = weekdayIndex(`${month}-01`);
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);
  const monthDays = cells.filter((d): d is string => d !== null && (byDay.get(d) ?? []).some((e) => e.kind !== "break"));

  const go = (delta: number) => {
    setMonth((cur) => {
      const next = shiftMonth(cur, delta);
      return next < first || next > last ? cur : next;
    });
    setSelected(null);
  };
  const pick = (day: string) => {
    setSelected(day);
    // porta l'appuntamento del giorno in vista, sotto il calendario
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-day="${day}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const counts = { match: 0, training: 0, paste: 0, birthday: 0 };
  for (const d of monthDays) for (const e of byDay.get(d) ?? []) if (e.kind !== "break") counts[e.kind]++;

  return (
    <div className="card overflow-hidden">
      {/* intestazione: mese e frecce */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={month <= first}
          aria-label="Mese precedente"
          className="grid size-10 place-items-center rounded-full bg-surface-2 text-text transition hover:bg-surface-3 disabled:opacity-30"
        >
          <IconChevronRight size={18} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="display text-3xl leading-none sm:text-4xl" aria-live="polite">
            {MONTHS[m - 1]} <span className="text-text/60">{y}</span>
          </p>
          {month !== monthKey(today) && today >= start && today <= end ? (
            <button
              type="button"
              onClick={() => {
                setMonth(monthKey(today));
                setSelected(null);
              }}
              className="mt-1 text-xs font-semibold text-primary"
            >
              Torna a oggi
            </button>
          ) : (
            <p className="mt-1 text-xs text-muted">
              {[
                counts.match && `${counts.match} ${counts.match === 1 ? "partita" : "partite"}`,
                counts.training && `${counts.training} allenamenti`,
                counts.paste && `${counts.paste} paste`,
              ]
                .filter(Boolean)
                .join(" · ") || "Nessun appuntamento"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={month >= last}
          aria-label="Mese successivo"
          className="grid size-10 place-items-center rounded-full bg-surface-2 text-text transition hover:bg-surface-3 disabled:opacity-30"
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      {/* griglia del mese */}
      <div className="px-2 pt-2 sm:px-4 sm:pt-3">
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <span key={i} />;
            const list = byDay.get(day) ?? [];
            const isBreak = list.some((e) => e.kind === "break");
            const has = (k: CalKind) => list.some((e) => e.kind === k);
            const active = list.some((e) => e.kind !== "break");
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                disabled={!active}
                onClick={() => pick(day)}
                aria-label={`${Number(day.slice(8))} ${MONTHS[m - 1]}${list.length ? `: ${list.map((e) => e.title).join(", ")}` : ""}`}
                className={cx(
                  "relative flex min-h-[3.4rem] flex-col items-center rounded-xl pb-1.5 pt-1 transition sm:min-h-[4.5rem]",
                  isBreak && "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(127_127_127/0.08)_6px_12px)]",
                  has("match") && "bg-primary/15",
                  selected === day ? "ring-2 ring-text/70" : isToday && "ring-2 ring-primary",
                  active && "hover:bg-surface-2",
                )}
              >
                <span className={cx("text-sm tabular-nums sm:text-base", isToday ? "font-bold text-primary" : active ? "font-semibold" : "text-text/45")}>
                  {Number(day.slice(8))}
                </span>
                <span className="mt-auto flex items-center gap-0.5 text-[13px] leading-none sm:text-base">
                  {has("match") && <span aria-hidden>🏀</span>}
                  {has("paste") && <span aria-hidden className={cx(list.find((e) => e.kind === "paste")?.done && "opacity-40")}>🥐</span>}
                  {has("birthday") && <span aria-hidden>🎂</span>}
                </span>
                {has("training") && <span aria-hidden className="absolute inset-x-2.5 bottom-0.5 h-1 rounded-full bg-sky sm:inset-x-4" />}
              </button>
            );
          })}
        </div>

        {/* legenda */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 py-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-sky" /> Allenamento
          </span>
          <span>🏀 Partita</span>
          <span>🥐 Paste</span>
          <span>🎂 Compleanno</span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(127_127_127/0.35)_3px_6px)]" /> Pausa
          </span>
        </div>
      </div>

      {/* elenco del mese */}
      <ol ref={listRef} className="divide-y divide-border border-t border-border">
        {monthDays.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nessun appuntamento in questo mese.</li>}
        {monthDays.map((day) => {
          const list = (byDay.get(day) ?? []).filter((e) => e.kind !== "break");
          return (
            <li
              key={day}
              data-day={day}
              className={cx("flex gap-3 px-4 py-3 transition-colors", selected === day && "bg-surface-2", day < today && "opacity-60")}
            >
              <div className="w-11 shrink-0 text-center">
                <p className={cx("display text-2xl leading-none", day === today && "text-primary")}>{Number(day.slice(8))}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted">{WEEKDAY_NAMES[weekdayIndex(day)]}</p>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {list.map((e, k) => {
                  const body = (
                    <>
                      <span className={cx("font-semibold", e.kind === "training" ? "text-text/85" : "text-text")}>{e.title}</span>
                      {e.time && <span className="ml-2 text-sm tabular-nums text-muted">{e.time}</span>}
                      {e.detail && <span className={cx("block text-xs", e.done ? "font-semibold text-primary" : "text-muted")}>{e.detail}</span>}
                    </>
                  );
                  return (
                    <li key={k} className="flex gap-2.5">
                      <span aria-hidden className={cx("mt-1 w-1 shrink-0 self-stretch rounded-full", KIND[e.kind].bar)} />
                      <span className="sr-only">{KIND[e.kind].label}: </span>
                      {e.href ? (
                        <Link href={e.href} className="min-w-0 hover:underline">
                          {body}
                        </Link>
                      ) : (
                        <span className="min-w-0">{body}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
