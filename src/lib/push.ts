/**
 * Notifiche push (Web Push). La chiave VAPID pubblica può stare nel codice: serve al browser per
 * iscriversi. La privata è solo nei secrets di GitHub (VAPID_PRIVATE_KEY), dove gira l'invio.
 */
export const VAPID_PUBLIC_KEY = "BHeOA6jt9bX5vZe9Trv6UiEyMcP44Jd_WNh0Nb5udgkz-FZJw-c05_xEXJQY0OJnGwhhc3tN8WSx9w_Eyac8jFU";

/** Chiave in base64url → byte, come la vuole pushManager.subscribe. */
export function vapidKeyBytes(key = VAPID_PUBLIC_KEY): Uint8Array<ArrayBuffer> {
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushKind = "giorno" | "ora" | "finale";

export interface MatchForPush {
  id: string;
  match_date: string | null;
  start_time: string | null;
  opponent_name: string | null;
  own_side: string | null;
  venue_name: string | null;
  own_score: number | null;
  opponent_score: number | null;
  status: string | null;
}

/** Minuti dalla mezzanotte, ora italiana. */
export function romeNow(now = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const vs = (m: MatchForPush) => `${m.own_side === "away" ? "@" : "vs"} ${m.opponent_name ?? "avversari"}`;

/** Ora del mattino da cui parte la notifica "oggi si gioca". */
export const MORNING = 9 * 60;

/**
 * Quali notifiche sono dovute adesso per una partita (prima di filtrare quelle già inviate).
 * - giorno: il giorno della partita dalle 9, fino a 75 minuti prima (poi vale "tra un'ora");
 * - ora: da un'ora prima all'inizio (+15 minuti di tolleranza);
 * - finale: quando c'è il risultato, entro il giorno dopo.
 */
export function duePushes(m: MatchForPush, now: { date: string; minutes: number }): { kind: PushKind; title: string; body: string; url: string }[] {
  const out: { kind: PushKind; title: string; body: string; url: string }[] = [];
  const url = `/partite/${m.id}`;
  if (!m.match_date || m.status === "cancelled" || m.status === "postponed") return out;
  const start = m.start_time ? toMinutes(m.start_time) : null;
  const when = [m.start_time ? `alle ${m.start_time.slice(0, 5)}` : null, m.venue_name].filter(Boolean).join(" · ");
  if (m.match_date === now.date && m.own_score === null) {
    if (now.minutes >= MORNING && (start === null || now.minutes < start - 75)) {
      out.push({ kind: "giorno", title: "🏀 Oggi giocano i Bolo Sgreeners", body: `${vs(m)}${when ? ` ${when}` : ""}`, url });
    }
    if (start !== null && now.minutes >= start - 60 && now.minutes <= start + 15) {
      out.push({ kind: "ora", title: "⏰ Tra un'ora si gioca", body: `Sgreeners ${vs(m)}${when ? ` · ${when}` : ""}`, url });
    }
  }
  const yesterday = new Date(`${now.date}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const recent = m.match_date === now.date || m.match_date === yesterday.toISOString().slice(0, 10);
  if (recent && m.own_score !== null && m.opponent_score !== null) {
    const won = m.own_score > m.opponent_score;
    out.push({
      kind: "finale",
      title: `${won ? "✅ Vittoria" : "Finale"}: Sgreeners ${m.own_score}–${m.opponent_score}`,
      body: `${vs(m)} · tabellino e statistiche sul sito`,
      url,
    });
  }
  return out;
}
