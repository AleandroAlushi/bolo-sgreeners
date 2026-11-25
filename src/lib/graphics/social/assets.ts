/**
 * Font e immagini delle grafiche "nuove" (stagione 2026-27, seconda serie): letti una volta sola
 * da assets/ e tenuti in memoria. Niente top-level await, così si possono provare anche dagli
 * script (scripts/graphics-preview.tsx).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const read = (p: string) => readFile(join(process.cwd(), "assets", p));
const dataUri = (b: Buffer, type = "image/png") => `data:${type};base64,${b.toString("base64")}`;

/** Basi delle grafiche in stile Canva (assets/grafiche/*.jpg): sfondi già pronti, senza scritte. */
export const BASES = ["presentazione-post", "presentazione-storia", "finale", "mvp", "box-score", "leader"] as const;
export type BaseName = (typeof BASES)[number];

export interface SocialAssets {
  fonts: { name: string; data: Buffer; weight: 400 | 500 | 600; style: "normal" | "italic" }[];
  logo: string;
  grain: string;
  /** sfondi come data URI (per <img>) e come file (per colorare le foto con i colori che hanno sotto) */
  bases: Record<BaseName, string>;
  baseFiles: Record<BaseName, Buffer>;
}

let loading: Promise<SocialAssets> | null = null;

export function socialAssets(): Promise<SocialAssets> {
  loading ??= Promise.all([
    read("fonts/BebasNeue-Regular.woff"),
    read("fonts/PlayfairDisplay-MediumItalic.woff"),
    read("fonts/Barlow-Regular.woff"),
    read("fonts/Barlow-SemiBold.woff"),
    read("brand/logo-320.png"),
    read("brand/grain.png"),
    Promise.all(BASES.map((b) => read(`grafiche/${b}.jpg`))),
  ]).then(([bebas, playfair, barlow, barlowSemi, logo, grain, bases]) => ({
    fonts: [
      { name: "Bebas", data: bebas, weight: 400, style: "normal" },
      { name: "Playfair", data: playfair, weight: 500, style: "italic" },
      { name: "Barlow", data: barlow, weight: 400, style: "normal" },
      { name: "Barlow", data: barlowSemi, weight: 600, style: "normal" },
    ],
    logo: dataUri(logo),
    grain: dataUri(grain),
    bases: Object.fromEntries(BASES.map((b, i) => [b, dataUri(bases[i], "image/jpeg")])) as Record<BaseName, string>,
    baseFiles: Object.fromEntries(BASES.map((b, i) => [b, bases[i]])) as Record<BaseName, Buffer>,
  }));
  return loading;
}
