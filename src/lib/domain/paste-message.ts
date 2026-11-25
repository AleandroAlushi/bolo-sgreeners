/**
 * Messaggio dei turni delle paste da mandare sul gruppo WhatsApp (grassetto con *…*).
 * Logica pura: le date sono stringhe ISO yyyy-mm-dd.
 */
import type { PasteSlot } from "./paste";

const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const DAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/** "gio 26/11" */
export const pasteDay = (iso: string) => `${DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function pasteMessage({
  season,
  slots,
  short,
  link,
}: {
  season: string;
  slots: PasteSlot[];
  /** soprannome per persona */
  short: (personId: string) => string;
  /** link all'area squadra (facoltativo) */
  link?: string;
}): string {
  const lines = [`🥐 *Turni delle paste ${season}*`, "Una volta l'anno a testa, all'allenamento:", ""];
  let month = "";
  for (const s of slots) {
    const m = s.day.slice(0, 7);
    if (m !== month) {
      if (month) lines.push("");
      lines.push(`*${MONTHS[Number(m.slice(5)) - 1]}*`);
      month = m;
    }
    lines.push(`${s.done ? "✅" : "▫️"} ${pasteDay(s.day)} · ${short(s.personId)}${s.done ? " (portate)" : ""}`);
  }
  lines.push("", "Se quel giorno c'è una partita, si slitta al primo allenamento libero.");
  if (link) lines.push(`Calendario completo: ${link}`);
  lines.push("Grazie a tutti! 💚");
  return lines.join("\n");
}
