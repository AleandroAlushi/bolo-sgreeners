"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface ViewerPhoto {
  url: string;
  caption: string;
}

const Ctx = createContext<(index: number) => void>(() => {});

/**
 * Foto a schermo intero: le foto dentro il provider, avvolte in <PhotoButton>, si aprono in grande
 * con un tocco. Frecce (anche da tastiera) per passare da una stagione all'altra, Esc o tocco
 * fuori dalla foto per chiudere.
 */
export function PhotoViewer({
  photos,
  children,
}: {
  photos: ViewerPhoto[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) =>
      setOpen((i) =>
        i === null ? i : (i + d + photos.length) % photos.length,
      ),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, step]);

  const photo = open === null ? null : photos[open];
  return (
    <Ctx.Provider value={setOpen}>
      {children}
      {/* in un portal su body: il contenitore della pagina crea un suo livello e terrebbe la foto sotto la barra in basso */}
      {photo &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={photo.caption}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={close}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- foto su Supabase Storage */}
            <img
              src={photo.url}
              alt={photo.caption}
              className="max-h-[80dvh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-3 text-sm font-semibold text-white/85">
              {photo.caption}
            </p>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={close}
              className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            >
              ×
            </button>
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Foto precedente"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                  className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Foto successiva"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                  className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
                >
                  ›
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

/** Rende apribile in grande ciò che contiene (la foto numero `index` del PhotoViewer). */
export function PhotoButton({
  index,
  label,
  className,
  children,
}: {
  index: number;
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  const openAt = useContext(Ctx);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => openAt(index)}
      className={className ?? "shrink-0 cursor-zoom-in"}
    >
      {children}
    </button>
  );
}
