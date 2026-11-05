/**
 * Notifiche push ai tifosi che le hanno attivate: il giorno della partita (dalle 9), un'ora prima
 * e a risultato pubblicato. Gira insieme al controllo del Livescore (workflow livescore.yml):
 * ogni volta guarda le partite di oggi e di ieri, invia quelle dovute e se le segna in push_log,
 * così non si ripetono.
 *
 *   npm run notify                # invia
 *   npm run notify -- --dry-run   # mostra cosa invierebbe
 *
 * Variabili: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY;
 * facoltative VAPID_SUBJECT (default: l'indirizzo del sito) e SITE_URL.
 */
import webpush from "web-push";
import { duePushes, romeNow, VAPID_PUBLIC_KEY, type MatchForPush } from "../../src/lib/push";
import { client } from "../import-historical/persist";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey && !dryRun) {
    console.log("VAPID_PRIVATE_KEY non impostata: notifiche disattivate.");
    return;
  }
  const site = process.env.SITE_URL ?? "https://bolo-sgreeners.vercel.app";
  if (privateKey) webpush.setVapidDetails(process.env.VAPID_SUBJECT || site, VAPID_PUBLIC_KEY, privateKey);

  const db = client();
  const now = romeNow();
  const yesterday = new Date(`${now.date}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const { data: matches, error } = await db
    .from("v_matches")
    .select("id, match_date, start_time, opponent_name, own_side, venue_name, own_score, opponent_score, status")
    .eq("involves_own_team", true)
    .gte("match_date", yesterday.toISOString().slice(0, 10))
    .lte("match_date", now.date);
  if (error) throw new Error(`Partite: ${error.message}`);
  const due = (matches ?? []).flatMap((m) => duePushes(m as MatchForPush, now).map((p) => ({ match: m.id!, ...p })));
  if (due.length === 0) {
    console.log(`Notifiche: niente da inviare (${now.date} ${Math.floor(now.minutes / 60)}:${String(now.minutes % 60).padStart(2, "0")}).`);
    return;
  }
  const { data: sent } = await db.from("push_log").select("match_id, kind").in("match_id", [...new Set(due.map((d) => d.match))]);
  const todo = due.filter((d) => !(sent ?? []).some((s) => s.match_id === d.match && s.kind === d.kind));
  if (todo.length === 0) {
    console.log("Notifiche: già inviate.");
    return;
  }
  const { data: subs, error: subErr } = await db.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (subErr) throw new Error(`Iscrizioni: ${subErr.message}`);
  for (const n of todo) {
    console.log(`${dryRun ? "[prova] " : ""}${n.kind}: ${n.title} — ${n.body} → ${subs?.length ?? 0} iscritti`);
    if (dryRun) continue;
    let ok = 0;
    const gone: string[] = [];
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: `${n.match}-${n.kind}` }),
          { TTL: 6 * 3600, urgency: n.kind === "giorno" ? "normal" : "high" },
        );
        ok++;
      } catch (e) {
        // 404/410: iscrizione scaduta o revocata dal telefono → si toglie
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
        else console.log(`  invio non riuscito (${code ?? "?"}): ${(e as Error).message}`);
      }
    }
    if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);
    await db.from("push_log").insert({ match_id: n.match, kind: n.kind, recipients: ok });
    console.log(`  inviate: ${ok}${gone.length ? `, ${gone.length} iscrizioni scadute tolte` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
