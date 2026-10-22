/**
 * Registro dei parser dei box score. Per supportare un nuovo formato:
 *   1. crea una cartella con extract.ts + normalize.ts (vedi easystats/);
 *   2. aggiungi un MatchReportParser a PARSERS;
 *   3. aggiorna la versione del parser quando cambia l'output (resta salvata negli import).
 */
import { extractEasyStats, isEasyStatsHtml, EASYSTATS_PARSER, EASYSTATS_PARSER_VERSION, ExtractionError } from "./easystats/extract";
import { normalizeEasyStats, type NormalizeOptions } from "./easystats/normalize";
import type { NormalizedMatchReport } from "./types";

export interface MatchReportParser {
  name: string;
  version: string;
  description: string;
  canParse(content: string): boolean;
  parse(content: string, opts: NormalizeOptions): NormalizedMatchReport;
}

export const PARSERS: MatchReportParser[] = [
  {
    name: EASYSTATS_PARSER,
    version: EASYSTATS_PARSER_VERSION,
    description: "Box score HTML esportati dall'app Easy Stats for Basketball",
    canParse: isEasyStatsHtml,
    parse: (content, opts) => normalizeEasyStats(extractEasyStats(content), opts),
  },
];

/** Analizza un file con il primo parser compatibile: HTML → dati normalizzati. */
export function parseMatchHtml(content: string, opts: NormalizeOptions): NormalizedMatchReport {
  const parser = PARSERS.find((p) => p.canParse(content));
  if (!parser) {
    throw new ExtractionError("Formato del file non riconosciuto da nessun parser", "unsupported_format");
  }
  return parser.parse(content, opts);
}

export { ExtractionError };
export * from "./types";
export * from "./normalize";
export * from "./mapping";
export * from "./validate";
export * from "./payload";
