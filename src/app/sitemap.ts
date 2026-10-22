import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getAllMatchIds } from "@/lib/data/matches";
import { getPlayers } from "@/lib/data/players";
import { getSeasons } from "@/lib/data/seasons";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [seasons, players, matchIds] = await Promise.all([getSeasons(), getPlayers(), getAllMatchIds()]);
  const url = (path: string) => `${env.siteUrl}${path}`;
  return [
    { url: url("/") },
    { url: url("/stagioni") },
    { url: url("/giocatori") },
    ...seasons.flatMap((s) =>
      ["", "/calendario", "/classifica", "/squadra", "/squadra/staff", "/statistiche"].map((sub) => ({ url: url(`/stagioni/${s.slug}${sub}`) })),
    ),
    ...players.map((p) => ({ url: url(`/giocatori/${p.slug}`) })),
    ...matchIds.map((id) => ({ url: url(`/partite/${id}`) })),
  ];
}
