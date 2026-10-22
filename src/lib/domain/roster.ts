/**
 * Ordinamento del roster per ruolo: dal playmaker al centro, i ruoli non riconosciuti in fondo.
 * Il ruolo è testo libero inserito dall'admin ("Play", "Guardia", "Ala grande"...).
 */
const ROLE_ORDER = ["play", "playmaker", "guardia", "combo", "ala piccola", "ala", "ala grande", "ala/centro", "centro", "pivot"];

export function roleRank(role: string | null | undefined): number {
  if (!role) return 99;
  const r = role.trim().toLowerCase();
  const exact = ROLE_ORDER.indexOf(r);
  if (exact !== -1) return exact;
  const partial = ROLE_ORDER.findIndex((x) => r.startsWith(x));
  return partial === -1 ? 50 : partial;
}

export function jerseyRank(jersey: string | null | undefined): number {
  // "0" prima di "00", poi in ordine numerico
  if (!jersey) return 999;
  return Number(jersey) + (jersey.length > 1 && jersey.startsWith("0") ? 0.5 : 0);
}
