import "server-only";
import { notFound } from "next/navigation";
import { getSeason, getSeasons } from "./seasons";

/** Parametri statici per le route di stagione (almeno uno, come richiesto da Cache Components). */
export async function seasonStaticParams() {
  const seasons = await getSeasons();
  return seasons.length > 0 ? seasons.map((s) => ({ stagione: s.slug })) : [{ stagione: "nessuna" }];
}

export async function resolveSeason(params: Promise<{ stagione: string }>) {
  const { stagione } = await params;
  const season = await getSeason(stagione);
  if (!season) notFound();
  return season;
}
