/**
 * Calendario delle partite in formato iCalendar (.ics, RFC 5545) per Apple Calendar, Google
 * Calendar, Outlook…, e link "aggiungi a Google Calendar" e alle mappe. Logica pura.
 * Orari in Europe/Rome; le partite senza orario diventano eventi di tutto il giorno.
 */
export interface CalendarMatch {
  id: string;
  date: string | null;
  /** "21:45" o "21:45:00" */
  time: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  address: string | null;
  /** competizione e giornata, es. "PCA Silver · 2ª giornata" */
  subtitle: string;
  url: string;
}

/** Durata indicativa di una partita CSI (riscaldamento escluso). */
const DURATION_MIN = 105;
const TZ = "Europe/Rome";

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Testo iCalendar: \ ; , e a capo vanno protetti. */
export const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Righe lunghe spezzate a 75 byte, con la continuazione che inizia con uno spazio. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (iso: string) => iso.replaceAll("-", "");
const compactTime = (time: string) => `${time.slice(0, 2)}${time.slice(3, 5)}00`;

/** Data e ora locali + minuti, senza fusi (il fuso lo dichiara TZID). */
function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const t = new Date(`${date}T${time.slice(0, 5)}:00Z`);
  t.setUTCMinutes(t.getUTCMinutes() + minutes);
  const iso = t.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const nextDay = (date: string) => {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

export function eventTitle(m: CalendarMatch): string {
  const score = m.homeScore !== null && m.awayScore !== null ? ` ${m.homeScore}-${m.awayScore}` : "";
  return `🏀 ${m.home} - ${m.away}${score}`;
}

export const placeLabel = (m: Pick<CalendarMatch, "venue" | "address">) => [m.venue, m.address].filter(Boolean).join(", ");

function eventLines(m: CalendarMatch, stamp: string): string[] {
  if (!m.date) return [];
  const lines = ["BEGIN:VEVENT", `UID:${m.id}@bolo-sgreeners`, `DTSTAMP:${stamp}`];
  if (m.time) {
    const end = addMinutes(m.date, m.time, DURATION_MIN);
    lines.push(`DTSTART;TZID=${TZ}:${compactDate(m.date)}T${compactTime(m.time)}`, `DTEND;TZID=${TZ}:${compactDate(end.date)}T${compactTime(end.time)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(m.date)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(m.date))}`);
  }
  lines.push(`SUMMARY:${escapeText(eventTitle(m))}`);
  const place = placeLabel(m);
  if (place) lines.push(`LOCATION:${escapeText(place)}`);
  lines.push(`DESCRIPTION:${escapeText(`${m.subtitle}\n${m.url}`)}`, `URL:${m.url}`, "END:VEVENT");
  return lines;
}

/** File .ics con una o più partite (quelle senza data vengono saltate). */
export function buildCalendar(name: string, matches: CalendarMatch[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bolo Sgreeners//Calendario partite//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${TZ}`,
    // chi si iscrive riceve gli aggiornamenti (orari, risultati) ogni poche ore
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...VTIMEZONE,
    ...matches.flatMap((m) => eventLines(m, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Link "aggiungi a Google Calendar" per una partita con data. */
export function googleCalendarUrl(m: CalendarMatch): string | null {
  if (!m.date) return null;
  const dates = m.time
    ? (() => {
        const end = addMinutes(m.date, m.time, DURATION_MIN);
        return `${compactDate(m.date)}T${compactTime(m.time)}/${compactDate(end.date)}T${compactTime(end.time)}`;
      })()
    : `${compactDate(m.date)}/${compactDate(nextDay(m.date))}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: eventTitle(m), dates, ctz: TZ, details: `${m.subtitle}\n${m.url}` });
  const place = placeLabel(m);
  if (place) p.set("location", place);
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Indicazioni per la palestra nelle app di navigazione. */
export function mapLinks(venue: string | null, address: string | null) {
  const query = [venue, address].filter(Boolean).join(", ");
  if (!query) return null;
  const q = encodeURIComponent(query);
  return {
    apple: `https://maps.apple.com/?q=${encodeURIComponent(venue ?? query)}${address ? `&address=${encodeURIComponent(address)}` : ""}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?q=${encodeURIComponent(address ?? query)}&navigate=yes`,
  };
}
