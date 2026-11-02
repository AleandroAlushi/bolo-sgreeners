"use client";

import type { InputHTMLAttributes } from "react";
import { Input } from "./fields";

/** Sotto questa soglia la foto parte così com'è. */
const KEEP_BELOW = 900 * 1024;

/**
 * Riduce una foto nel browser prima dell'invio (lato lungo `maxSide`, JPG): le foto del telefono
 * pesano 3-5 MB e le Server Action ne accettano pochi. Se il browser non riesce a leggerla
 * (es. HEIC fuori da Safari) si invia l'originale e decide il server.
 */
export async function shrinkImage(file: File, maxSide = 1600): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= KEEP_BELOW) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Campo foto dei form admin: la foto scelta viene ridotta prima che il form la invii. */
export function PhotoInput({ maxSide, ...props }: InputHTMLAttributes<HTMLInputElement> & { maxSide?: number }) {
  return (
    <Input
      type="file"
      accept="image/*"
      {...props}
      onChange={async (e) => {
        const input = e.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        const small = await shrinkImage(file, maxSide);
        if (small === file) return;
        const dt = new DataTransfer();
        dt.items.add(small);
        input.files = dt.files;
      }}
    />
  );
}
