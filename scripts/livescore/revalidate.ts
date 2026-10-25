/** Chiede al sito di rigenerare le pagine con i dati nuovi (altrimenti entro un'ora). */
export async function revalidateSite() {
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) {
    console.log("SITE_URL o REVALIDATE_SECRET non impostati: il sito si aggiornerà entro un'ora.");
    return;
  }
  const res = await fetch(new URL("/api/revalidate", site), { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  if (!res.ok) throw new Error(`Aggiornamento del sito non riuscito: HTTP ${res.status}`);
  console.log("Sito aggiornato: le pagine mostrano i dati nuovi.");
}
