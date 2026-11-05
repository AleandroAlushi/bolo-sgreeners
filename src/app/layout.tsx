import type { Metadata, Viewport } from "next";
import { Barlow, Bebas_Neue, Playfair_Display } from "next/font/google";
import { Swish } from "@/components/swish";
import { THEME_COLORS, themeBootScript } from "@/lib/theme";
import { env } from "@/lib/env";
import "./globals.css";

const body = Barlow({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const display = Bebas_Neue({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const accent = Playfair_Display({ variable: "--font-accent", subsets: ["latin"], weight: ["500", "700"], style: "italic" });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "Bolo Sgreeners", template: "%s · Bolo Sgreeners" },
  description: "Archivio ufficiale dei Bolo Sgreeners, squadra di basket CSI di Bologna: stagioni, partite, statistiche, classifiche e giocatori.",
  applicationName: "Bolo Sgreeners",
  appleWebApp: { capable: true, title: "Sgreeners", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Bolo Sgreeners",
    title: "Bolo Sgreeners",
    description: "Stagioni, partite, statistiche e storia dei Bolo Sgreeners — basket CSI Bologna.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.dark,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme lo imposta lo script qui sotto prima del primo disegno: per React non è un errore
    <html lang="it" suppressHydrationWarning className={`${body.variable} ${display.variable} ${accent.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* il logo dell'apertura arriva insieme alla pagina, non dopo */}
        <link rel="preload" href="/brand/logo-160.png" as="image" fetchPriority="high" />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* solo nell'app installata (display-mode: standalone), vedi .app-splash in globals.css */}
        <div className="app-splash" aria-hidden>
          <div className="app-splash__stage">
            <span className="app-splash__glow" />
            <span className="app-splash__mark">
              {/* l'arco del tiro che si disegna attorno al logo */}
              <svg className="app-splash__arc" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="sg-splash-arc" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0" stopColor="#19d35e" />
                    <stop offset="0.5" stopColor="#d9d21c" />
                    <stop offset="1" stopColor="#f2a20c" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="47" pathLength={1} stroke="url(#sg-splash-arc)" transform="rotate(130 50 50)" />
              </svg>
              {/* eslint-disable-next-line @next/next/no-img-element -- splash statico, prima di tutto il resto */}
              <img src="/brand/logo-160.png" alt="" width={160} height={118} decoding="sync" />
            </span>
            <p className="app-splash__name">
              Bolo <span>Sgreeners</span>
            </p>
          </div>
        </div>
        {/* swish della retina all'apertura dell'app installata */}
        <Swish />
        {children}
      </body>
    </html>
  );
}
