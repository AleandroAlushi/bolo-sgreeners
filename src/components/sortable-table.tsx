"use client";

import { useState, type ReactNode } from "react";
import { cx } from "./ui";

export interface SortColumn {
  key: string;
  label: string;
  title: string;
  /** "high": il valore più alto è il migliore (punti, rimbalzi...); "low": il più basso (perse, falli) */
  better: "high" | "low";
  strong?: boolean;
}

export interface SortRow {
  key: string;
  /** prima cella (nome, partita, stagione) */
  head: ReactNode;
  cells: string[];
  /** valori numerici per ordinare, nello stesso ordine delle colonne (null = in fondo) */
  values: (number | null)[];
  className?: string;
  title?: string;
  /** righe poco indicative (es. pochi minuti nei valori per 30'): restano sotto le altre */
  demote?: boolean;
}

/**
 * Tabella statistiche ordinabile: un tocco sull'intestazione mette in alto il migliore in quella
 * voce, un secondo tocco inverte. Senza ordinamento le righe restano nell'ordine ricevuto.
 */
export function SortableTable({
  columns,
  rows,
  firstHeader,
  footer,
  headClassName = "max-w-[12rem]",
}: {
  columns: SortColumn[];
  rows: SortRow[];
  firstHeader: string;
  footer?: { head: ReactNode; cells: string[] } | null;
  headClassName?: string;
}) {
  // ordinamento legato al nome della colonna: resta giusto anche se le colonne cambiano (totali / per 30')
  const [sortState, setSort] = useState<{ key: string; best: boolean } | null>(null);
  const sortCol = sortState ? columns.findIndex((c) => c.key === sortState.key) : -1;
  const sort = sortState && sortCol >= 0 ? { col: sortCol, best: sortState.best } : null;

  const sorted = sort
    ? [...rows].sort((a, b) => {
        if (!!a.demote !== !!b.demote) return a.demote ? 1 : -1;
        const va = a.values[sort.col];
        const vb = b.values[sort.col];
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        const highFirst = (columns[sort.col].better === "high") === sort.best;
        return highFirst ? vb - va : va - vb;
      })
    : rows;

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="stat-table">
        <thead>
          <tr>
            <th>{firstHeader}</th>
            {columns.map((c, i) => {
              const active = sort?.col === i;
              return (
                <th key={c.key} title={c.title} aria-sort={active ? ((columns[i].better === "high") === sort.best ? "descending" : "ascending") : undefined}>
                  <button
                    type="button"
                    onClick={() => setSort(active ? { key: c.key, best: !sort.best } : { key: c.key, best: true })}
                    className={cx("inline-flex items-center gap-0.5 whitespace-nowrap uppercase hover:text-primary", active && "text-primary")}
                    title={`Ordina per ${c.title.toLowerCase()}`}
                  >
                    {c.label}
                    <span aria-hidden className={cx("text-[0.6rem]", !active && "opacity-0")}>
                      {active && !sort.best ? "▲" : "▼"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} className={r.className} title={r.title}>
              <td className={headClassName}>{r.head}</td>
              {r.cells.map((cell, i) => (
                <td key={columns[i].key} className={cx("tabular-nums", columns[i].strong && "font-semibold text-text", sort?.col === i && "bg-primary/5")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <td>{footer.head}</td>
              {footer.cells.map((cell, i) => (
                <td key={columns[i].key} className="tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
