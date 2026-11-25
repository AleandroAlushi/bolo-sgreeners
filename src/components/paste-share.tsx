"use client";

import { useState, useSyncExternalStore } from "react";
import { IconDownload, IconShare } from "./icons";

/**
 * Turni delle paste da mandare sul gruppo WhatsApp: il messaggio di testo (foglio di
 * condivisione del telefono, altrimenti WhatsApp o "Copia") e l'immagine in formato storia.
 */
export function PasteShare({ message }: { message: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  const flash = (s: string) => {
    setStatus(s);
    setTimeout(() => setStatus(null), 2500);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      flash("Messaggio copiato ✓");
    } catch {
      flash("Non riesco a copiare: usa WhatsApp");
    }
  };
  const shareText = async () => {
    if (!canShare) return void window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noreferrer");
    try {
      await navigator.share({ text: message });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) void copy();
    }
  };
  const shareImage = async () => {
    setStatus("Preparo l'immagine…");
    try {
      const res = await fetch("/grafiche/paste");
      if (!res.ok) throw new Error(String(res.status));
      const file = new File([await res.blob()], "turni-paste.png", { type: "image/png" });
      if (canShare && navigator.canShare?.({ files: [file] })) {
        setStatus(null);
        await navigator.share({ files: [file] });
        return;
      }
      // sul computer: si scarica
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      flash("Immagine scaricata ✓");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return setStatus(null);
      flash("Immagine non disponibile, riprova");
    }
  };

  const btn =
    "inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/60 hover:text-primary";
  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="font-semibold">Manda i turni sul gruppo</p>
        <p className="text-sm text-muted">Il messaggio con tutte le date, oppure l&apos;immagine da mettere su WhatsApp.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={shareText} className={btn}>
          <IconShare size={16} /> Messaggio
        </button>
        <button type="button" onClick={shareImage} className={btn}>
          <IconDownload size={16} /> Immagine
        </button>
        {!canShare && (
          <button type="button" onClick={copy} className={btn}>
            Copia il testo
          </button>
        )}
      </div>
      {status && <p className="text-sm text-primary" aria-live="polite">{status}</p>}
    </div>
  );
}
