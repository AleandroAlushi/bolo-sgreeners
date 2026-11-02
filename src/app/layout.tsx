import type { Metadata, Viewport } from "next";
import { Barlow, Bebas_Neue, Playfair_Display } from "next/font/google";
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
          {/* eslint-disable-next-line @next/next/no-img-element -- splash statico, prima di tutto il resto */}
          <img src="/brand/logo-160.png" alt="" width={120} height={89} decoding="sync" />
        </div>
        {children}
      </body>
    </html>
  );
}
