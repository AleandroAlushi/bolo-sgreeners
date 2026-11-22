"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { deleteGalleryPhoto, saveCutout, saveDefaultPhoto, setSeasonVideo } from "@/lib/admin/actions";
import { publicMediaUrl, videoPosterUrl } from "@/lib/media";
import { canRecordMp4, prepareLoopVideo } from "@/lib/media/loop-video";
import { browserClient } from "@/lib/supabase/browser";
import { cx } from "../ui";
import { shrinkImage } from "./photo-input";

export interface MediaPerson {
  kind: "player" | "staff";
  id: string;
  slug: string;
  name: string;
  /** "#18" per i giocatori, il ruolo per lo staff */
  sub: string;
  caricature: string | null;
  seasonPhoto: string | null;
  video: string | null;
  /** solo giocatori */
  cutout?: string | null;
  gallery?: string[];
}

const CROPS = [
  { value: "0.3", label: "Alto (testa e spalle)" },
  { value: "0.6", label: "Centro" },
  { value: "0.85", label: "Basso (mani e gesti in basso)" },
];

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Thumb({ src, video, label }: { src: string | null; video?: boolean; label: string }) {
  if (!src) return <div className="flex aspect-[4/5] w-24 items-center justify-center rounded-lg border border-dashed border-border text-center text-[0.65rem] text-muted">{label}</div>;
  return video ? (
    <video src={publicMediaUrl(src)!} poster={videoPosterUrl(src) ?? undefined} autoPlay muted loop playsInline className="aspect-[4/5] w-24 rounded-lg object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- anteprima dallo storage
    <img src={publicMediaUrl(src)!} alt={label} className="aspect-[4/5] w-24 rounded-lg bg-[linear-gradient(180deg,#a6622f,#3dd35a,#2a92d6)] object-contain" />
  );
}

function FilePick({ label, accept, disabled, onPick }: { label: string; accept: string; disabled?: boolean; onPick: (f: File) => void }) {
  return (
    <label className={cx("inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:border-primary/50", disabled && "pointer-events-none opacity-50")}>
      {label}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
    </label>
  );
}

/** Il browser sa registrare MP4? Solo nel browser (sul server la risposta è sempre no). */
const useCanRecordMp4 = () => useSyncExternalStore(() => () => {}, canRecordMp4, () => false);

function PersonMedia({ p, seasonId, seasonSlug }: { p: MediaPerson; seasonId: string; seasonSlug: string }) {
  const router = useRouter();
  const mp4 = useCanRecordMp4();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [crop, setCrop] = useState("0.6");
  const folder = p.kind === "player" ? "players" : "staff";
  const run = (label: string, fn: () => Promise<string>) =>
    start(async () => {
      setMsg(label);
      try {
        setMsg(await fn());
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Qualcosa non è andato: riprova.");
      }
    });

  const uploadCaricature = (f: File) =>
    run("Caricamento della caricatura…", async () => {
      const fd = new FormData();
      fd.set("kind", p.kind);
      fd.set("id", p.id);
      fd.set("photo", await shrinkImage(f, 2000));
      return (await saveDefaultPhoto(fd)).message;
    });

  const uploadVideo = (f: File) =>
    run("Preparo il video (taglio 4:5, senza audio)…", async () => {
      const { video, poster } = await prepareLoopVideo(f, Number(crop));
      if (video.size > 4.8 * 1024 * 1024) throw new Error("Video troppo pesante anche dopo la preparazione: usane uno più corto.");
      setMsg("Carico il video…");
      const base = `${folder}/${seasonSlug}/${p.slug}-video-${Date.now()}`;
      const storage = browserClient().storage.from("media");
      const up1 = await storage.upload(`${base}.jpg`, poster, { contentType: "image/jpeg" });
      if (up1.error) throw new Error(`Copertina non caricata: ${up1.error.message}`);
      const up2 = await storage.upload(`${base}.mp4`, video, { contentType: "video/mp4" });
      if (up2.error) throw new Error(`Video non caricato: ${up2.error.message}`);
      const fd = new FormData();
      fd.set("kind", p.kind);
      fd.set("season_id", seasonId);
      fd.set("person_id", p.id);
      fd.set("path", `${base}.mp4`);
      return (await setSeasonVideo(fd)).message;
    });

  const removeVideo = () =>
    run("Tolgo il video…", async () => {
      const fd = new FormData();
      fd.set("kind", p.kind);
      fd.set("season_id", seasonId);
      fd.set("person_id", p.id);
      fd.set("path", "");
      return (await setSeasonVideo(fd)).message;
    });

  const uploadCutout = (f: File) =>
    run("Carico lo scontorno…", async () => {
      if (f.type !== "image/png") throw new Error("Lo scontorno dev'essere un PNG con lo sfondo trasparente.");
      const fd = new FormData();
      fd.set("season_id", seasonId);
      fd.set("player_id", p.id);
      fd.set("photo", f);
      return (await saveCutout(fd)).message;
    });

  const uploadGame = (f: File) =>
    run("Carico la foto nella galleria…", async () => {
      if (!/^image\/(png|jpeg)$/.test(f.type)) throw new Error("Serve un PNG (meglio scontornato) o un JPG.");
      if (f.size > 4.8 * 1024 * 1024) throw new Error("Foto troppo pesante (massimo 5 MB).");
      const name = `${Date.now()}-${f.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
      const { error } = await browserClient().storage.from("media").upload(`foto-partita/${p.slug}/${name}`, f, { contentType: f.type });
      if (error) throw new Error(`Foto non caricata: ${error.message}`);
      return "Foto aggiunta alla galleria.";
    });

  const removeGame = (path: string) => run("Tolgo la foto…", async () => (await deleteGalleryPhoto(path)).message);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Block title="Caricatura" hint="Foto predefinita: tondino, statistiche, diretta, grafiche.">
          <div className="flex items-end gap-3">
            <Thumb src={p.caricature} label="nessuna" />
            <FilePick label="Cambia" accept="image/jpeg,image/png" disabled={busy} onPick={uploadCaricature} />
          </div>
        </Block>
        <Block title={`Video ${seasonSlug}`} hint="In loop al posto della foto nella figurina della stagione.">
          <div className="flex items-end gap-3">
            <Thumb src={p.video} video label={p.seasonPhoto ? "solo foto" : "nessuno"} />
            <div className="space-y-2">
              <select value={crop} onChange={(e) => setCrop(e.target.value)} aria-label="Taglio del video" className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs">
                {CROPS.map((c) => (
                  <option key={c.value} value={c.value}>
                    Taglio: {c.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <FilePick label={p.video ? "Cambia video" : "Carica video"} accept="video/*" disabled={busy || !mp4} onPick={uploadVideo} />
                {p.video && (
                  <button type="button" disabled={busy} onClick={removeVideo} className="text-xs font-semibold text-loss hover:underline">
                    Togli
                  </button>
                )}
              </div>
              {!mp4 && <p className="text-xs text-warning">Per i video usa Safari sull&apos;iPhone o un Chrome aggiornato.</p>}
            </div>
          </div>
        </Block>
        {p.kind === "player" && (
          <Block title="Scontorno a mezzo busto" hint="PNG trasparente per MVP e leader delle grafiche.">
            <div className="flex items-end gap-3">
              <Thumb src={p.cutout ?? null} label="nessuno" />
              <FilePick label="Carica PNG" accept="image/png" disabled={busy} onPick={uploadCutout} />
            </div>
          </Block>
        )}
        {p.kind === "player" && (
          <Block title="Foto in partita" hint="Galleria per la presentazione della partita (meglio scontornate, PNG).">
            <div className="flex flex-wrap items-end gap-2">
              {(p.gallery ?? []).map((g) => (
                <div key={g} className="space-y-1 text-center">
                  <Thumb src={g} label="" />
                  <button type="button" disabled={busy} onClick={() => removeGame(g)} className="text-xs font-semibold text-loss hover:underline">
                    Togli
                  </button>
                </div>
              ))}
              <FilePick label="Aggiungi" accept="image/png,image/jpeg" disabled={busy} onPick={uploadGame} />
            </div>
          </Block>
        )}
      </div>
      {msg && <p className="text-sm text-muted">{busy ? `${msg}` : msg}</p>}
    </div>
  );
}

/** Foto e video di tutta la squadra e dello staff della stagione, una scheda per persona. */
export function MediaManager({ people, seasonId, seasonSlug }: { people: MediaPerson[]; seasonId: string; seasonSlug: string }) {
  const [q, setQ] = useState("");
  const shown = people.filter((p) => `${p.name} ${p.sub}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-3">
      <label htmlFor="filtro-foto" className="sr-only">
        Filtra per nome
      </label>
      <input
        id="filtro-foto"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtra per nome…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:max-w-xs"
      />
      <div className="space-y-2">
        {shown.map((p) => (
          <details key={`${p.kind}-${p.id}`} className="card group p-3 sm:p-4">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              {p.caricature ? (
                // eslint-disable-next-line @next/next/no-img-element -- anteprima dallo storage
                <img src={publicMediaUrl(p.caricature)!} alt="" className="size-12 shrink-0 rounded-full object-cover object-top" />
              ) : (
                <span className="size-12 shrink-0 rounded-full bg-surface-2" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-muted">{p.sub}</span>
              </span>
              <span className="flex flex-wrap justify-end gap-1 text-[0.65rem] font-semibold uppercase tracking-wide">
                <span className={cx("rounded-full px-2 py-0.5", p.video ? "bg-win/15 text-win" : "bg-surface-2 text-muted")}>video</span>
                {p.kind === "player" && <span className={cx("rounded-full px-2 py-0.5", p.cutout ? "bg-win/15 text-win" : "bg-surface-2 text-muted")}>scontorno</span>}
                {p.kind === "player" && (p.gallery?.length ?? 0) > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{p.gallery!.length} in partita</span>}
              </span>
            </summary>
            <div className="mt-4">
              <PersonMedia p={p} seasonId={seasonId} seasonSlug={seasonSlug} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
