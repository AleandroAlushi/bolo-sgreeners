/**
 * Font e immagini delle grafiche "nuove" (stagione 2026-27, seconda serie): letti una volta sola
 * da assets/ e tenuti in memoria. Niente top-level await, così si possono provare anche dagli
 * script (scripts/graphics-preview.tsx).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const read = (p: string) => readFile(join(process.cwd(), "assets", p));
const dataUri = (b: Buffer, type = "image/png") => `data:${type};base64,${b.toString("base64")}`;

export interface SocialAssets {
  fonts: { name: string; data: Buffer; weight: 400 | 500 | 600; style: "normal" | "italic" }[];
  logo: string;
  grain: string;
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
  ]).then(([bebas, playfair, barlow, barlowSemi, logo, grain]) => ({
    fonts: [
      { name: "Bebas", data: bebas, weight: 400, style: "normal" },
      { name: "Playfair", data: playfair, weight: 500, style: "italic" },
      { name: "Barlow", data: barlow, weight: 400, style: "normal" },
      { name: "Barlow", data: barlowSemi, weight: 600, style: "normal" },
    ],
    logo: dataUri(logo),
    grain: dataUri(grain),
  }));
  return loading;
}
