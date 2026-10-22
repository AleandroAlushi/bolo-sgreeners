import "server-only";
/**
 * Grafiche generate dal sito (post e storie Instagram) nello stile dei post @bolo.sgreeners:
 * fondo nero con sfumature verde/giallo/ambra e grana, numeri in Bebas Neue, accenti in
 * Playfair Display corsivo. Usato dalle route in src/app/grafiche (ImageResponse / Satori:
 * solo flexbox e un sottoinsieme di CSS).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

const asset = (p: string) => readFile(join(process.cwd(), "assets", p));
const [bebas, playfair, barlow, barlowSemi, logo, grain] = await Promise.all([
  asset("fonts/BebasNeue-Regular.woff"),
  asset("fonts/PlayfairDisplay-MediumItalic.woff"),
  asset("fonts/Barlow-Regular.woff"),
  asset("fonts/Barlow-SemiBold.woff"),
  asset("brand/logo-320.png"),
  asset("brand/grain.png"),
]);

export const FONTS = [
  { name: "Bebas", data: bebas, weight: 400 as const, style: "normal" as const },
  { name: "Playfair", data: playfair, weight: 500 as const, style: "italic" as const },
  { name: "Barlow", data: barlow, weight: 400 as const, style: "normal" as const },
  { name: "Barlow", data: barlowSemi, weight: 600 as const, style: "normal" as const },
];

export const LOGO = `data:image/png;base64,${logo.toString("base64")}`;
const GRAIN = `data:image/png;base64,${grain.toString("base64")}`;

export const C = {
  bg: "#070907",
  text: "#f3f5ef",
  muted: "rgba(243,245,239,0.72)",
  green: "#19d35e",
  yellow: "#d9d21c",
  amber: "#f2a20c",
  gold: "#e3b858",
};

export const SIZES = {
  post: { width: 1080, height: 1350 },
  storia: { width: 1080, height: 1920 },
} as const;
export type GraphicFormat = keyof typeof SIZES;
export const formatFrom = (url: string): GraphicFormat => (new URL(url).searchParams.get("formato") === "storia" ? "storia" : "post");

/** Sfondo con sfumature e grana, e cornice comune (logo e firma). */
export function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", backgroundColor: C.bg, fontFamily: "Barlow", color: C.text }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundImage: [
            `radial-gradient(circle at 0% 0%, rgba(25,211,94,0.95), rgba(25,211,94,0) 55%)`,
            `radial-gradient(circle at 100% 22%, rgba(242,162,12,0.9), rgba(242,162,12,0) 55%)`,
            `radial-gradient(circle at 60% 100%, rgba(217,210,28,0.55), rgba(217,210,28,0) 60%)`,
          ].join(", "),
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", backgroundImage: `linear-gradient(180deg, rgba(7,9,7,0) 40%, rgba(7,9,7,0.75) 100%)` }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", backgroundImage: `url(${GRAIN})`, backgroundRepeat: "repeat", backgroundSize: "256px 256px", opacity: 0.9 }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
          <img src={LOGO} width={150} height={111} alt="" />
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: C.muted, maxWidth: 680, textAlign: "right" }}>{label}</div>
        </div>
        {children}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26, color: C.muted, letterSpacing: 4, textTransform: "uppercase" }}>
          <span>Bolo Sgreeners</span>
          <span>@bolo.sgreeners</span>
        </div>
      </div>
    </div>
  );
}

const hue = (seed: string) => [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
export const initials = (name: string) => {
  const words = name.replace(/.*\s[-/]\s/, "").split(/[\s/]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
};

/** Badge squadra: logo per gli Sgreeners, iniziali per gli avversari. */
export function TeamMark({ name, own, size }: { name: string; own: boolean; size: number }) {
  if (own) {
    return (
      <div style={{ display: "flex", width: size, height: size, borderRadius: size, backgroundColor: "#000", alignItems: "center", justifyContent: "center", border: `3px solid ${C.green}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
        <img src={LOGO} width={size * 0.8} height={size * 0.8 * 0.74} alt="" />
      </div>
    );
  }
  const h = hue(name);
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size, backgroundColor: `hsl(${h}, 30%, 17%)`, color: `hsl(${h}, 70%, 78%)`, alignItems: "center", justifyContent: "center", fontFamily: "Bebas", fontSize: size * 0.48 }}>
      {initials(name)}
    </div>
  );
}

const fmtDate = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const longDate = (iso: string | null) => {
  const s = iso ? fmtDate.format(new Date(`${iso}T12:00:00Z`)) : "Data da definire";
  return s.charAt(0).toUpperCase() + s.slice(1);
};
