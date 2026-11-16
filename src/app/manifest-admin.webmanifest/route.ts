import type { MetadataRoute } from "next";

/**
 * Manifest dell'app "Sgreeners Admin": aggiunta alla schermata Home da una pagina /admin, si apre
 * direttamente sulle partite (per prendere le statistiche) e resta dentro l'area admin.
 * Il manifest del sito pubblico è app/manifest.ts.
 */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/admin",
    name: "Sgreeners Admin",
    short_name: "Sgr Admin",
    description: "Area admin dei Bolo Sgreeners: partite, statistiche e grafiche.",
    lang: "it",
    start_url: "/admin/partite",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070907",
    theme_color: "#070907",
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
