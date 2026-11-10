"use client";

import { useEffect, useState, useTransition } from "react";
import { uploadGraphicPhoto } from "@/lib/admin/actions";
import { cx } from "../ui";
import { shrinkImage } from "./photo-input";
import { Field, Input, Select } from "./fields";

export interface StudioMatch {
  id: string;
  label: string;
  date: string | null;
  played: boolean;
  hasBoxScore: boolean;
}

interface Captions {
  pre: string;
  post: string | null;
  mvp: { name: string; auto: boolean } | null;
}

/** Partita da mostrare all'apertura: quella di oggi, altrimenti la prossima, altrimenti l'ultima. */
function defaultMatch(matches: StudioMatch[], today: string) {
  const byDate = [...matches].filter((m) => m.date).sort((a, b) => a.date!.localeCompare(b.date!));
  return (
    byDate.find((m) => m.date === today) ?? byDate.find((m) => m.date! > today && !m.played) ?? [...byDate].reverse().find((m) => m.played) ?? matches[0]
  )?.id;
}

function PhotoUpload({ label, hint, value, onChange }: { label: string; hint: string; value: string | null; onChange: (p: string | null) => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, start] = useTransition();
  return (
    <div className="space-y-1">
      <Field label={label} hint={hint}>
        <Input
          type="file"
          accept="image/jpeg,image/png"
          disabled={uploading}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            start(async () => {
              const fd = new FormData();
              fd.set("photo", await shrinkImage(picked, 2000));
              const res = await uploadGraphicPhoto(fd);
              setMessage(res.message);
              if (res.ok && res.path) onChange(res.path);
            });
          }}
        />
      </Field>
      {(uploading || message) && <p className="text-sm text-muted">{uploading ? "Caricamento…" : message}</p>}
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-sm text-loss hover:underline">
          Togli la foto
        </button>
      )}
    </div>
  );
}

function Shot({ src, file, label, story = false }: { src: string; file: string; label: string; story?: boolean }) {
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- anteprima generata al volo */}
      <img src={src} alt={label} loading="lazy" className={cx("w-full rounded-xl border border-border bg-surface-2", story ? "aspect-[9/16]" : "aspect-[4/5]")} />
      <figcaption className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <a href={src} download={file} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-ink">
          Scarica
        </a>
      </figcaption>
    </figure>
  );
}

function CaptionBox({ text }: { text: string }) {
  const [value, setValue] = useState(text);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.min(10, value.split("\n").length + 1)}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm leading-relaxed"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold"
      >
        {copied ? "Copiata ✓" : "Copia didascalia"}
      </button>
    </div>
  );
}

/**
 * Grafiche Instagram della partita: la mattina della gara presentazione (post e storia) con
 * didascalia; dopo l'import del box score il carosello (finale, MVP, box score, leader) con la
 * didascalia scritta dai numeri. In fondo le grafiche "vecchie" (tifosi, calendario del mese).
 */
export function GraphicsStudio({ matches, months, seasonSlug, today }: { matches: StudioMatch[]; months: { value: string; label: string }[]; seasonSlug: string; today: string }) {
  const [matchId, setMatchId] = useState(() => defaultMatch(matches, today) ?? "");
  const [prePhoto, setPrePhoto] = useState<string | null>(null);
  const [mvpPhoto, setMvpPhoto] = useState<string | null>(null);
  const [captions, setCaptions] = useState<{ id: string; c: Captions } | null>(null);
  const [extra, setExtra] = useState<"tifosi" | "calendario">("tifosi");
  const [month, setMonth] = useState(months[0]?.value ?? "");
  const [extraFormat, setExtraFormat] = useState<"post" | "storia">("storia");
  const match = matches.find((m) => m.id === matchId);

  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    fetch(`/grafiche/didascalia/${matchId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Captions | null) => {
        if (alive && c) setCaptions({ id: matchId, c });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [matchId]);
  const c = captions?.id === matchId ? captions.c : null;

  const q = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] !== null));
    return sp.size ? `?${sp}` : "";
  };
  const slug = match?.label.split(" · ").slice(0, 2).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "partita";

  return (
    <div className="space-y-8">
      <Field label="Partita">
        <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.date === today ? "OGGI · " : ""}
              {m.label}
            </option>
          ))}
        </Select>
      </Field>

      {match && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Prima della partita</h3>
            <p className="text-sm text-muted">Presentazione da pubblicare la mattina della gara: post e storia, con i loghi delle due squadre.</p>
          </div>
          <PhotoUpload label="Foto (facoltativa)" hint="Va nella colonna colorata a destra. Senza foto resta solo lo sfondo." value={prePhoto} onChange={setPrePhoto} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_0.72fr]">
            <Shot src={`/grafiche/presentazione/${match.id}${q({ formato: "post", foto: prePhoto })}`} file={`${slug}-presentazione-post.png`} label="Post" />
            <Shot src={`/grafiche/presentazione/${match.id}${q({ formato: "storia", foto: prePhoto })}`} file={`${slug}-presentazione-storia.png`} label="Storia" story />
          </div>
          {c && <CaptionBox key={`pre-${matchId}`} text={c.pre} />}
        </section>
      )}

      {match && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Dopo la partita</h3>
            <p className="text-sm text-muted">
              Carosello nell&apos;ordine del post: finale, MVP, box score e leader. Servono il risultato e il box score (Importa partita).
            </p>
          </div>
          {!match.played ? (
            <p className="text-sm text-muted">La partita non è ancora giocata.</p>
          ) : (
            <>
              {c?.mvp && (
                <p className="text-sm">
                  MVP: <strong>{c.mvp.name}</strong>
                  {c.mvp.auto && <span className="text-muted"> · scelto dalla valutazione: per cambiarlo indicalo nella partita (Partite → MVP)</span>}
                </p>
              )}
              {match.hasBoxScore && <PhotoUpload label="Foto dell'MVP (facoltativa)" hint="Senza foto si usa quella del roster." value={mvpPhoto} onChange={setMvpPhoto} />}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Shot src={`/grafiche/partita/${match.id}`} file={`${slug}-1-finale.png`} label="1 · Finale" />
                {match.hasBoxScore ? (
                  <>
                    <Shot src={`/grafiche/mvp/${match.id}${q({ foto: mvpPhoto })}`} file={`${slug}-2-mvp.png`} label="2 · MVP" />
                    <Shot src={`/grafiche/tabellino/${match.id}`} file={`${slug}-3-box-score.png`} label="3 · Box score" />
                    <Shot src={`/grafiche/leader/${match.id}`} file={`${slug}-4-leader.png`} label="4 · Leader" />
                  </>
                ) : (
                  <p className="col-span-1 text-sm text-muted lg:col-span-3">MVP, box score e leader arrivano dopo l&apos;import del box score.</p>
                )}
              </div>
              {c?.post && <CaptionBox key={`post-${matchId}`} text={c.post} />}
            </>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Altre grafiche</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["tifosi", "Chiamata ai tifosi"],
              ["calendario", "Calendario del mese"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setExtra(k)} className={cx("rounded-full border px-4 py-1.5 text-sm font-semibold", extra === k ? "border-primary bg-primary/10" : "border-border")}>
              {label}
            </button>
          ))}
          <div className="inline-flex rounded-full border border-border bg-surface p-1">
            {(["post", "storia"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setExtraFormat(f)} className={cx("rounded-full px-3 py-0.5 text-sm font-semibold", extraFormat === f ? "bg-primary text-primary-ink" : "text-muted")}>
                {f === "post" ? "Post" : "Storia"}
              </button>
            ))}
          </div>
        </div>
        {extra === "calendario" && (
          <Field label="Mese">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="max-w-xs">
          {extra === "tifosi" && match && <Shot src={`/grafiche/tifosi/${match.id}?formato=${extraFormat}`} file={`${slug}-tifosi.png`} label="Tifosi" story={extraFormat === "storia"} />}
          {extra === "calendario" && month && (
            <Shot src={`/grafiche/calendario/${seasonSlug}?formato=${extraFormat}&mese=${month}`} file={`calendario-${month}.png`} label="Calendario" story={extraFormat === "storia"} />
          )}
        </div>
      </section>
    </div>
  );
}
