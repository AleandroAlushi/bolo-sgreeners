import "server-only";
/**
 * Grafiche generate dal sito (post e storie Instagram) nello stile della stagione 2026-27 di
 * @bolo.sgreeners: fondo nero con grana, scie di luce al neon (azzurro, verde, giallo), titoli
 * condensati enormi in Bebas Neue, accenti in Playfair Display corsivo, riquadri verdi per le
 * partite in casa e arancioni per quelle in trasferta. Usato dalle route in src/app/grafiche
 * (ImageResponse / Satori: solo flexbox e un sottoinsieme di CSS, niente filter/blur).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { publicMediaUrl } from "@/lib/media";

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
  bg: "#0a0b0a",
  text: "#f6f1ec",
  muted: "rgba(246,241,236,0.7)",
  cyan: "#3fd2e6",
  green: "#3ee08f",
  lime: "#7fd12e",
  yellow: "#d8dc22",
  blue: "#3b7fe0",
  orange: "#f5a524",
  gold: "#e3b858",
};

/** Bordo dei riquadri partita: verde in casa, arancio in trasferta (come nel calendario). */
export const sideColor = (home: boolean | null | undefined) => (home === false ? C.orange : C.lime);

export const SIZES = {
  post: { width: 1080, height: 1350 },
  storia: { width: 1080, height: 1920 },
} as const;
export type GraphicFormat = keyof typeof SIZES;

export interface GraphicOptions {
  format: GraphicFormat;
  /** foto di sfondo (percorso nel bucket media), caricata dall'admin */
  photo: string | null;
  /** titolo personalizzato (al posto di quello standard) */
  title: string | null;
}

/** Opzioni comuni dalla query: ?formato=post|storia&foto=grafiche/x.jpg&titolo=... */
export function optionsFrom(url: string, fallback: GraphicFormat = "post"): GraphicOptions {
  const sp = new URL(url).searchParams;
  const f = sp.get("formato");
  const photo = sp.get("foto");
  const title = sp.get("titolo")?.trim().slice(0, 40) || null;
  return {
    format: f === "storia" || f === "post" ? f : fallback,
    // solo file del bucket media (niente URL esterni)
    photo: photo && /^[a-z0-9][a-z0-9/_.-]*\.(jpe?g|png)$/i.test(photo) && !photo.includes("..") ? publicMediaUrl(photo) : null,
    title,
  };
}

/** Una scia di luce verticale: colonne affiancate con opacità a campana (Satori non ha il blur). */
function Streak({ left, width, colors, top = 0, height = "100%" }: { left: number; width: number; colors: string[]; top?: number | string; height?: number | string }) {
  const falloff = [0.08, 0.18, 0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35, 0.18, 0.08];
  return (
    <div style={{ position: "absolute", left, top, height, width, display: "flex" }}>
      {falloff.map((o, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flex: 1,
            opacity: o,
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${colors.map((c, j) => `${c} ${Math.round(18 + (j * 64) / Math.max(1, colors.length - 1))}%`).join(", ")}, rgba(0,0,0,0) 100%)`,
          }}
        />
      ))}
    </div>
  );
}

/** Le scie al neon sul lato destro, come nelle grafiche del calendario. */
export function NeonStreaks({ width, height }: { width: number; height: number }) {
  const x = width * 0.62;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex" }}>
      <Streak left={x} width={150} colors={[C.cyan, C.green, C.yellow]} />
      <Streak left={x + 140} width={110} colors={[C.blue, C.cyan, C.green]} top={-40} />
      <Streak left={x + 250} width={170} colors={[C.green, C.yellow, C.green]} top={60} />
      <Streak left={x + 360} width={120} colors={[C.cyan, C.blue]} top={-80} />
    </div>
  );
}

/**
 * Tela comune: fondo nero, scie al neon o pannello azzurro-verde, foto facoltativa, grana,
 * logo in alto e firma in basso.
 */
export function Canvas({
  format,
  photo,
  label,
  children,
  panel = false,
  photoSide = "bottom",
}: {
  format: GraphicFormat;
  photo?: string | null;
  label?: string;
  children: ReactNode;
  /** pannello sfumato azzurro → verde dietro al contenuto (stile pagine "Novembre", "Dicembre") */
  panel?: boolean;
  photoSide?: "bottom" | "right";
}) {
  const { width, height } = SIZES[format];
  return (
    <div style={{ display: "flex", width, height, position: "relative", backgroundColor: C.bg, fontFamily: "Barlow", color: C.text, overflow: "hidden" }}>
      {panel ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: width * 0.5,
            height,
            display: "flex",
            backgroundImage: `linear-gradient(180deg, ${C.blue} 0%, #23b7c6 28%, #2fcf86 55%, #2a8f3e 75%, rgba(10,11,10,0) 100%)`,
          }}
        />
      ) : (
        <NeonStreaks width={width} height={height} />
      )}
      {photo && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            ...(photoSide === "right" ? { top: 0, right: 0, width: width * 0.55, height } : { left: 0, bottom: 0, width, height: height * 0.5 }),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
          <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              backgroundImage:
                photoSide === "right"
                  ? `linear-gradient(90deg, ${C.bg} 0%, rgba(10,11,10,0.2) 40%, rgba(10,11,10,0) 100%)`
                  : `linear-gradient(180deg, ${C.bg} 0%, rgba(10,11,10,0.15) 35%, rgba(10,11,10,0) 70%, rgba(10,11,10,0.6) 100%)`,
            }}
          />
        </div>
      )}
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", backgroundImage: `url(${GRAIN})`, backgroundRepeat: "repeat", backgroundSize: "256px 256px", opacity: 0.55 }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width, height, padding: "60px 64px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
          <img src={LOGO} width={132} height={98} alt="" />
          {label && <div style={{ display: "flex", fontSize: 26, letterSpacing: 5, textTransform: "uppercase", color: C.muted, maxWidth: 700, textAlign: "right" }}>{label}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ fontFamily: "Playfair", fontStyle: "italic", fontSize: 52, lineHeight: 1 }}>Bolo Sgreeners</span>
          <span style={{ fontSize: 26, color: C.muted, letterSpacing: 4, textTransform: "uppercase" }}>@bolo.sgreeners</span>
        </div>
      </div>
    </div>
  );
}

/** Titolo condensato enorme ("OTTOBRE", "GAME DAY"). */
export function BigTitle({ children, size = 200, color = C.text }: { children: ReactNode; size?: number; color?: string }) {
  return <div style={{ display: "flex", fontFamily: "Bebas", fontSize: size, lineHeight: 0.86, color, letterSpacing: 1 }}>{children}</div>;
}

/** Accento in corsivo serif ("Final Score", "andata"). */
export function Accent({ children, size = 64, color = C.text }: { children: ReactNode; size?: number; color?: string }) {
  return <div style={{ display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontSize: size, lineHeight: 1, color }}>{children}</div>;
}

const hue = (seed: string) => [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
export const initials = (name: string) => {
  const words = name.replace(/.*\s[-/]\s/, "").split(/[\s/]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
};

/** Badge squadra: logo (Sgreeners o logo caricato dall'admin), altrimenti iniziali. */
export function TeamMark({ name, own, logoUrl, size }: { name: string; own: boolean; logoUrl?: string | null; size: number }) {
  const src = own ? LOGO : logoUrl;
  if (src) {
    return (
      <div style={{ display: "flex", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- immagine dentro ImageResponse */}
        <img src={src} alt="" style={{ maxWidth: size, maxHeight: size, objectFit: "contain" }} />
      </div>
    );
  }
  const h = hue(name);
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size, backgroundColor: `hsl(${h}, 30%, 17%)`, color: `hsl(${h}, 70%, 80%)`, alignItems: "center", justifyContent: "center", fontFamily: "Bebas", fontSize: size * 0.46, border: `3px solid hsl(${h}, 45%, 40%)` }}>
      {initials(name)}
    </div>
  );
}

const DAYS = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
/** "MAR" */
export const dayShort = (iso: string | null) => (iso ? DAYS[utc(iso).getUTCDay()] : "TBD");
/** "27.10" */
export const dayMonth = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "--.--");
/** "21:45" */
export const clock = (time: string | null) => (time ? time.slice(0, 5) : "--:--");

const fmtDate = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const longDate = (iso: string | null) => {
  const s = iso ? fmtDate.format(utc(iso)) : "Data da definire";
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtMonth = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
/** "NOVEMBRE" */
export const monthName = (iso: string) => fmtMonth.format(utc(iso)).toUpperCase();

/** Riquadro partita del calendario: logo avversario e giorno / data / ora, bordo casa-trasferta. */
export function MatchBox({ name, logoUrl, home, date, time, scale = 1 }: { name: string; logoUrl?: string | null; home: boolean | null; date: string | null; time: string | null; scale?: number }) {
  const s = (n: number) => Math.round(n * scale);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s(28), padding: `${s(26)}px ${s(34)}px`, border: `${s(6)}px solid ${sideColor(home)}`, backgroundColor: "rgba(10,11,10,0.45)" }}>
      <TeamMark name={name} own={false} logoUrl={logoUrl} size={s(190)} />
      <div style={{ display: "flex", flexDirection: "column", fontSize: s(66), lineHeight: 1.08, letterSpacing: -1 }}>
        <span>{dayShort(date)}</span>
        <span>{dayMonth(date)}</span>
        <span>{clock(time)}</span>
      </div>
    </div>
  );
}

/** Legenda dei riquadri: arancio trasferta, verde casa. */
export function SideLegend({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: size * 0.4 }}>
      {[
        { label: "TRASFERTA", color: C.orange },
        { label: "CASA", color: C.lime },
      ].map((l) => (
        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: size * 0.4, fontSize: size }}>
          <div style={{ display: "flex", width: size * 1.4, height: size, border: `${Math.max(3, size / 9)}px solid ${l.color}` }} />
          {l.label}
        </div>
      ))}
    </div>
  );
}
