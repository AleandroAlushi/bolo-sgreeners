"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { ScoreFlow } from "@/lib/live/flow";
import { cx } from "./ui";

const ZOOMS = [1, 2, 3, 4, 6];

/** "Q2 · 6:45" (tempo che resta nel periodo, come sul tabellone) dal secondo di gioco. */
function moment(flow: ScoreFlow, x: number, i: number) {
  if (!flow.byTime) return `Canestro ${i}`;
  const bounds = [0, ...flow.periodEnds.map((p) => p.x), flow.maxX];
  const labels = [...flow.periodEnds.map((p) => p.label), flow.lastLabel];
  let k = bounds.findIndex((b, j) => j > 0 && x <= b) - 1;
  if (k < 0) k = labels.length - 1;
  const left = Math.max(0, Math.round(bounds[k + 1] - x));
  return `${labels[k]} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/**
 * Andamento del punteggio di una partita giocata (dalla diretta del sito), come il grafico della
 * pagina live ma interattivo: si ingrandisce (pulsanti o tocco su un quarto), si scorre in
 * orizzontale e toccando o passando sopra il grafico si vede il punteggio di quel momento.
 */
export function ScoreFlowChart({ flow, ownName, opponentName }: { flow: ScoreFlow; ownName: string; opponentName: string }) {
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const W = 640 * zoom;
  const H = 240;
  const pad = { l: 30, r: 12, t: 14, b: 30 };
  const top = Math.max(10, ...flow.points.map((p) => Math.max(p.own, p.opp)));
  const x = (v: number) => pad.l + (v / flow.maxX) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / top) * (H - pad.t - pad.b);
  const path = (k: "own" | "opp") => flow.points.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const bounds = [0, ...flow.periodEnds.map((p) => p.x), flow.maxX];
  const labels = flow.periodEnds.length ? [...flow.periodEnds.map((p) => p.label), flow.lastLabel] : [];
  const best = flow.points.reduce((m, p) => Math.max(m, p.own - p.opp), 0);
  const worst = flow.points.reduce((m, p) => Math.min(m, p.own - p.opp), 0);

  // ingrandisce tenendo fermo il centro di ciò che si sta guardando
  const setZoomKeep = (z: number, focusX?: number) => {
    const el = scroller.current;
    const centre = focusX ?? (el ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0.5);
    setZoom(z);
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = centre * el.scrollWidth - el.clientWidth / 2;
    });
  };
  const zoomTo = (period: number) => {
    const z = Math.min(ZOOMS[ZOOMS.length - 1], Math.max(2, labels.length));
    setZoomKeep(z, (bounds[period] + bounds[period + 1]) / 2 / flow.maxX);
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const data = ((vx - pad.l) / (W - pad.l - pad.r)) * flow.maxX;
    // l'ultimo canestro prima di quel momento
    let i = 0;
    while (i + 1 < flow.points.length && flow.points[i + 1].x <= data) i++;
    setHover(i);
  };
  const h = hover !== null ? flow.points[hover] : null;
  const zi = ZOOMS.indexOf(zoom);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-primary">● {ownName}</span>
          <span className="text-secondary">● {opponentName}</span>
          {best > 0 && <span className="text-muted">Massimo vantaggio +{best}</span>}
          {worst < 0 && <span className="text-muted">Massimo svantaggio {worst}</span>}
        </p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Riduci" disabled={zi <= 0} onClick={() => setZoomKeep(ZOOMS[zi - 1])} className="grid size-8 place-items-center rounded-full border border-border text-lg leading-none disabled:opacity-40">
            −
          </button>
          <button type="button" aria-label="Ingrandisci" disabled={zi >= ZOOMS.length - 1} onClick={() => setZoomKeep(ZOOMS[zi + 1])} className="grid size-8 place-items-center rounded-full border border-border text-lg leading-none disabled:opacity-40">
            +
          </button>
          {zoom > 1 && (
            <button type="button" onClick={() => setZoomKeep(1, 0.5)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
              Tutta
            </button>
          )}
        </div>
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l, i) => (
            <button key={l} type="button" onClick={() => zoomTo(i)} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted hover:text-text">
              {l}
            </button>
          ))}
        </div>
      )}

      <p className={cx("min-h-5 text-sm tabular-nums", !h && "text-muted")}>
        {h ? (
          <>
            <span className="text-muted">{moment(flow, h.x, hover!)}</span> · <span className="font-semibold text-primary">{h.own}</span>-<span className="font-semibold text-secondary">{h.opp}</span>{" "}
            <span className="text-muted">({h.own - h.opp > 0 ? `+${h.own - h.opp}` : h.own - h.opp})</span>
          </>
        ) : (
          "Tocca il grafico per vedere il punteggio in ogni momento."
        )}
      </p>

      <div ref={scroller} className="overflow-x-auto overscroll-x-contain pb-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
          className="h-auto touch-pan-x select-none"
          role="img"
          aria-label="Andamento del punteggio"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={pad.l} x2={W - pad.r} y1={y(top * f)} y2={y(top * f)} stroke="currentColor" className="text-border" strokeDasharray="2 4" />
          ))}
          {[0.5, 1].map((f) => (
            <text key={f} x={pad.l - 6} y={y(top * f) + 4} textAnchor="end" className="fill-current text-[10px] text-muted">
              {Math.round(top * f)}
            </text>
          ))}
          {flow.periodEnds.map((p) => (
            <line key={p.x} x1={x(p.x)} x2={x(p.x)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-border" />
          ))}
          {labels.map((l, i) => (
            <text key={l} x={(x(bounds[i]) + x(bounds[i + 1])) / 2} y={H - 10} textAnchor="middle" className="fill-current text-[11px] text-muted">
              {l}
            </text>
          ))}
          <path d={path("opp")} fill="none" stroke="var(--sg-secondary)" strokeWidth={2.5} strokeLinejoin="round" />
          <path d={path("own")} fill="none" stroke="var(--sg-primary)" strokeWidth={2.5} strokeLinejoin="round" />
          {h && (
            <g>
              <line x1={x(h.x)} x2={x(h.x)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-text/40" strokeDasharray="3 3" />
              <circle cx={x(h.x)} cy={y(h.opp)} r={4.5} fill="var(--sg-secondary)" />
              <circle cx={x(h.x)} cy={y(h.own)} r={4.5} fill="var(--sg-primary)" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
