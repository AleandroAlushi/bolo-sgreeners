import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const body = Barlow({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
});

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
  themeColor: "#06080a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
