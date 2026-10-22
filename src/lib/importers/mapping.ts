/**
 * Mapping dei nomi trovati nei file verso i giocatori del database tramite alias.
 *
 * Regole:
 *  - il confronto avviene sul nome normalizzato (minuscolo, senza accenti);
 *  - un alias può essere limitato a una stagione e/o a un numero di maglia
 *    (es. "Chicco" con #32 = Federico Hrvatin, con #2 = Francesco Carini);
 *  - vince l'alias più specifico; se a parità di specificità puntano a giocatori
 *    diversi il risultato è "ambiguous" e serve una scelta manuale;
 *  - nessun giocatore viene mai creato automaticamente.
 */
import { normalizePlayerName } from "./normalize";
import type { AliasRecord, PlayerMapping, PlayerRef } from "./types";

function specificity(a: AliasRecord): number {
  return (a.jersey !== null ? 2 : 0) + (a.seasonId !== null ? 1 : 0);
}

export function matchPlayerAlias(
  input: { rawLabel: string; name: string; jersey: string | null },
  aliases: AliasRecord[],
  players: PlayerRef[],
  seasonId: string | null,
): PlayerMapping {
  const key = normalizePlayerName(input.name);
  const base = { rawLabel: input.rawLabel, name: input.name, jersey: input.jersey };

  const applicable = aliases.filter(
    (a) =>
      normalizePlayerName(a.alias) === key &&
      (a.seasonId === null || a.seasonId === seasonId) &&
      (a.jersey === null || a.jersey === input.jersey),
  );
  // Il nome completo del giocatore vale come alias implicito generico.
  for (const p of players) {
    if (normalizePlayerName(p.displayName) === key) {
      applicable.push({ playerId: p.id, alias: p.displayName, seasonId: null, jersey: null });
    }
  }

  if (applicable.length === 0) {
    const conditional = aliases.filter((a) => normalizePlayerName(a.alias) === key);
    return {
      ...base,
      status: "unmatched",
      playerId: null,
      candidates: [...new Set(conditional.map((a) => a.playerId))],
      reason:
        conditional.length > 0
          ? "Alias noto ma con condizioni (stagione/numero) non soddisfatte"
          : "Nome non riconosciuto",
    };
  }

  const best = Math.max(...applicable.map(specificity));
  const top = [...new Set(applicable.filter((a) => specificity(a) === best).map((a) => a.playerId))];
  if (top.length > 1) {
    return {
      ...base,
      status: "ambiguous",
      playerId: null,
      candidates: top,
      reason: "Alias associato a più giocatori: serve una scelta manuale",
    };
  }
  return { ...base, status: "matched", playerId: top[0], candidates: top, reason: "Alias riconosciuto" };
}

export function mapPlayers(
  lines: { rawLabel: string; name: string; jersey: string | null }[],
  aliases: AliasRecord[],
  players: PlayerRef[],
  seasonId: string | null,
): PlayerMapping[] {
  const result = lines.map((l) => matchPlayerAlias(l, aliases, players, seasonId));
  // Due righe dello stesso file non possono finire sullo stesso giocatore.
  const seen = new Map<string, number>();
  result.forEach((m) => {
    if (m.playerId) seen.set(m.playerId, (seen.get(m.playerId) ?? 0) + 1);
  });
  return result.map((m) =>
    m.playerId && (seen.get(m.playerId) ?? 0) > 1
      ? {
          ...m,
          status: "ambiguous" as const,
          candidates: [m.playerId],
          playerId: null,
          reason: "Più righe del file puntano allo stesso giocatore",
        }
      : m,
  );
}
