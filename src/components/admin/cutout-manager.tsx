"use client";

import { useState } from "react";
import { saveCutout } from "@/lib/admin/actions";
import { cutoutPerson } from "@/lib/graphics/cutout";

export interface CutoutPlayer {
  playerId: string;
  name: string;
  jersey: string | null;
  photo: string | null;
  cutout: string | null;
}

type Status = { busy?: boolean; error?: string; preview?: string };

/**
 * Scontorni dei giocatori per le grafiche MVP e leader: si ricavano nel browser dalla foto della
 * stagione (o da un'altra foto caricata qui) e si salvano sul sito.
 */
export function CutoutManager({ seasonId, players }: { seasonId: string; players: CutoutPlayer[] }) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);
  const set = (id: string, s: Status) => setStatus((prev) => ({ ...prev, [id]: s }));

  async function process(p: CutoutPlayer, source: Blob | string) {
    set(p.playerId, { busy: true });
    try {
      const png = await cutoutPerson(source);
      const fd = new FormData();
      fd.set("season_id", seasonId);
      fd.set("player_id", p.playerId);
      fd.set("photo", new File([png], "scontorno.png", { type: "image/png" }));
      const res = await saveCutout(fd);
      set(p.playerId, res.ok ? { preview: URL.createObjectURL(png) } : { error: res.message });
    } catch (e) {
      set(p.playerId, { error: e instanceof Error ? e.message : "Scontorno non riuscito" });
    }
  }

  const missing = players.filter((p) => p.photo && !p.cutout && !status[p.playerId]?.preview);
  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <button
          type="button"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            for (const p of missing) await process(p, p.photo!);
            setRunning(false);
          }}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-ink disabled:opacity-50"
        >
          {running ? "Scontorno in corso…" : `Scontorna le foto che mancano (${missing.length})`}
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {players.map((p) => {
          const s = status[p.playerId] ?? {};
          const shown = s.preview ?? p.cutout;
          return (
            <div key={p.playerId} className="space-y-2 rounded-xl border border-border p-2">
              <div className="flex aspect-[4/5] items-end justify-center overflow-hidden rounded-lg bg-[linear-gradient(180deg,#2a86d0,#3cc86c)]">
                {shown ? (
                  // eslint-disable-next-line @next/next/no-img-element -- anteprima dello scontorno
                  <img src={shown} alt="" className="max-h-full max-w-full object-contain" />
                ) : p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto della stagione
                  <img src={p.photo} alt="" className="h-full w-full object-cover opacity-60" />
                ) : (
                  <span className="pb-6 text-xs text-white/80">Nessuna foto</span>
                )}
              </div>
              <p className="truncate text-sm font-semibold">
                {p.jersey && <span className="text-muted">#{p.jersey} </span>}
                {p.name}
              </p>
              <p className="text-xs text-muted">{s.busy ? "Scontorno…" : s.error ? <span className="text-loss">{s.error}</span> : shown ? "Scontorno pronto" : p.photo ? "Da scontornare" : "Carica una foto"}</p>
              <div className="flex flex-wrap gap-2">
                {p.photo && (
                  <button type="button" disabled={s.busy || running} onClick={() => process(p, p.photo!)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold disabled:opacity-50">
                    {shown ? "Rifai" : "Scontorna"}
                  </button>
                )}
                <label className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs font-semibold">
                  Altra foto
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    disabled={s.busy || running}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) process(p, f);
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
