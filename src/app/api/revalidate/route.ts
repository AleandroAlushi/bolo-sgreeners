import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { DATA_TAG } from "@/lib/data/core";

/**
 * Rigenera le pagine pubbliche dopo un aggiornamento fatto fuori dall'app (es. lo script
 * `npm run livescore:update` su GitHub Actions). Protetto da REVALIDATE_SECRET:
 *   curl -X POST https://<sito>/api/revalidate -H "Authorization: Bearer <segreto>"
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: "REVALIDATE_SECRET non configurato" }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }
  // nessun dato vecchio servito: la prossima visita legge subito dal database
  revalidateTag(DATA_TAG, { expire: 0 });
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
