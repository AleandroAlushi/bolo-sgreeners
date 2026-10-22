import type { Metadata, Viewport } from "next";
import { Barlow, Bebas_Neue, Playfair_Display } from "next/font/google";
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
  themeColor: "#070907",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${body.variable} ${display.variable} ${accent.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
