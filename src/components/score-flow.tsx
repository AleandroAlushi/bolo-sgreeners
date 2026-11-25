import type { ScoreFlow } from "@/lib/live/flow";

/**
 * Andamento del punteggio di una partita giocata (dalla diretta del sito), come il grafico della
 * pagina live: linea verde per noi, gialla per gli avversari, linee di fine periodo.
 */
export function ScoreFlowChart({ flow, ownName, opponentName }: { flow: ScoreFlow; ownName: string; opponentName: string }) {
  const W = 640;
  const H = 230;
  const pad = { l: 28, r: 10, t: 12, b: 30 };
  const top = Math.max(10, ...flow.points.map((p) => Math.max(p.own, p.opp)));
  const x = (v: number) => pad.l + (v / flow.maxX) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / top) * (H - pad.t - pad.b);
  const path = (k: "own" | "opp") => flow.points.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const bounds = [0, ...flow.periodEnds.map((p) => p.x), flow.maxX];
  const labels = flow.periodEnds.length ? [...flow.periodEnds.map((p) => p.label), flow.lastLabel] : [];
  const best = flow.points.reduce((m, p) => Math.max(m, p.own - p.opp), 0);
  const worst = flow.points.reduce((m, p) => Math.min(m, p.own - p.opp), 0);
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-primary">● {ownName}</span>
        <span className="text-secondary">● {opponentName}</span>
        {best > 0 && <span className="text-muted">Massimo vantaggio +{best}</span>}
        {worst < 0 && <span className="text-muted">Massimo svantaggio {worst}</span>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Andamento del punteggio">
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
      </svg>
    </div>
  );
}
