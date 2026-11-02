import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    // logo e icone dell'app: il telefono li tiene una settimana invece di richiederli a ogni apertura
    const cache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }];
    return [
      { source: "/brand/:file*", headers: cache },
      { source: "/icons/:file*", headers: cache },
    ];
  },
  async redirects() {
    // la sezione "Roster" è diventata "Squadra" (roster + staff)
    return [{ source: "/stagioni/:stagione/roster", destination: "/stagioni/:stagione/squadra", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
