"use client";

import { useState, useTransition } from "react";
import { uploadGraphicPhoto } from "@/lib/admin/actions";
import { cx } from "../ui";
import { Field, Input, Select } from "./fields";

export interface StudioMatch {
  id: string;
  label: string;
  played: boolean;
  hasBoxScore: boolean;
  hasMvp: boolean;
}

const TEMPLATES = [
  { key: "presentazione", label: "Game day (presentazione)", when: "prima" },
  { key: "tifosi", label: "Chiamata ai tifosi", when: "prima" },
  { key: "partita", label: "Final Score", when: "dopo" },
  { key: "tabellino", label: "Tabellino (migliori e marcatori)", when: "box" },
  { key: "mvp", label: "MVP", when: "mvp" },
  { key: "calendario", label: "Calendario del mese", when: "mese" },
] as const;
type TemplateKey = (typeof TEMPLATES)[number]["key"];

/**
 * Genera le grafiche Instagram dalle route /grafiche: scegli partita (o mese), modello e
 * formato, eventualmente una foto di sfondo e un titolo; anteprima e download.
 */
export function GraphicsStudio({ matches, months, seasonSlug }: { matches: StudioMatch[]; months: { value: string; label: string }[]; seasonSlug: string }) {
  // le partite arrivano dalla più recente: di default la prossima da giocare
  const [matchId, setMatchId] = useState([...matches].reverse().find((m) => !m.played)?.id ?? matches[0]?.id ?? "");
  const [template, setTemplate] = useState<TemplateKey>("presentazione");
  const [format, setFormat] = useState<"post" | "storia">("post");
  const [month, setMonth] = useState(months[0]?.value ?? "");
  const [title, setTitle] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  const match = matches.find((m) => m.id === matchId);
  const available = (key: TemplateKey) => {
    const t = TEMPLATES.find((x) => x.key === key)!;
    if (t.when === "mese") return months.length > 0;
    if (!match) return false;
    if (t.when === "prima") return true;
    if (t.when === "dopo") return true;
    if (t.when === "box") return match.played && match.hasBoxScore;
    return match.hasMvp;
  };
  const params = new URLSearchParams({ formato: format });
  if (photo) params.set("foto", photo);
  if (title.trim()) params.set("titolo", title.trim());
  if (template === "calendario") params.set("mese", month);
  const src = available(template)
    ? template === "calendario"
      ? `/grafiche/calendario/${seasonSlug}?${params}`
      : `/grafiche/${template}/${matchId}?${params}`
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Modello</p>
          <div className="grid gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={!available(t.key)}
                onClick={() => setTemplate(t.key)}
                className={cx(
                  "rounded-lg border px-3 py-2 text-left text-sm font-semibold disabled:opacity-35",
                  template === t.key ? "border-primary bg-primary/10" : "border-border hover:border-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {template === "calendario" ? (
          <Field label="Mese">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Partita">
            <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {(["post", "storia"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFormat(f)} className={cx("rounded-full px-4 py-1 text-sm font-semibold", format === f ? "bg-primary text-primary-ink" : "text-muted")}>
              {f === "post" ? "Post 4:5" : "Storia 9:16"}
            </button>
          ))}
        </div>
        <Field label="Titolo (facoltativo)" hint="Al posto di quello standard, massimo 40 caratteri.">
          <Input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="es. DERBY DAY" />
        </Field>
        <Field label="Foto di sfondo (facoltativa)" hint="JPG o PNG, massimo 5 MB.">
          <Input
            type="file"
            accept="image/jpeg,image/png"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.set("photo", file);
              startUpload(async () => {
                const res = await uploadGraphicPhoto(fd);
                setMessage(res.message);
                if (res.ok && res.path) setPhoto(res.path);
              });
            }}
          />
        </Field>
        {photo && (
          <button type="button" onClick={() => setPhoto(null)} className="text-sm text-loss hover:underline">
            Togli la foto
          </button>
        )}
        {(uploading || message) && <p className="text-sm text-muted">{uploading ? "Caricamento…" : message}</p>}
      </div>
      <div className="space-y-3">
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- anteprima generata al volo */}
            <img key={src} src={src} alt="Anteprima della grafica" className={cx("mx-auto w-full rounded-xl border border-border", format === "post" ? "max-w-md" : "max-w-xs")} />
            <div className="flex flex-wrap justify-center gap-2">
              <a href={src} download={`sgreeners-${template}-${format}.png`} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
                Scarica PNG
              </a>
              <a href={src} target="_blank" rel="noreferrer" className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
                Apri in una nuova scheda
              </a>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Questo modello non è disponibile per la partita scelta (serve il box score o l&apos;MVP).</p>
        )}
      </div>
    </div>
  );
}
