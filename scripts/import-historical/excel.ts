/**
 * Estrazione dei dati dagli Excel storici (fase "estrazione" per la fonte Excel).
 * Restituisce righe tipizzate; nessuna logica di database qui.
 */
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";

export type Cell = string | number | Date | boolean | null;
export type Row = Record<string, Cell>;

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    return null;
  }
  return v as Cell;
}

/** Legge le righe di un foglio a partire dalla riga di intestazione che inizia con `firstHeader`. */
export function readTable(ws: ExcelJS.Worksheet, firstHeader: string, opts: { stopAtBlank?: boolean } = {}): Row[] {
  let header: string[] | null = null;
  let stopped = false;
  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    if (stopped) return;
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
    if (!header) {
      if (values[0] === firstHeader) header = values.map((v) => (v === null ? "" : String(v)));
      return;
    }
    if (values.every((v) => v === null || v === "")) {
      if (opts.stopAtBlank) stopped = true;
      return;
    }
    const obj: Row = {};
    header.forEach((h, i) => {
      if (h) obj[h] = values[i] ?? null;
    });
    rows.push(obj);
  });
  return rows;
}

export const str = (c: Cell | undefined): string | null =>
  c === null || c === undefined ? null : String(c).normalize("NFC").trim() || null;

export const num = (c: Cell | undefined): number | null => {
  if (c === null || c === undefined || c === "") return null;
  const n = typeof c === "number" ? c : Number(String(c).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const isoDate = (c: Cell | undefined): string | null => {
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  const s = str(c);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/** "41:40" o 41.67 → minuti decimali. */
export const minutes = (c: Cell | undefined): number | null => {
  const s = str(c);
  if (s && /^\d+:\d{2}$/.test(s)) {
    const [m, sec] = s.split(":").map(Number);
    return Math.round((m + sec / 60) * 100) / 100;
  }
  const n = num(c);
  return n === null ? null : Math.round(n * 100) / 100;
};

/**
 * Gli Excel delle fonti sono generati con Open XML SDK: XML con BOM, elementi con prefisso
 * di namespace ("<x:sheet>") e percorsi assoluti nei .rels ("/xl/workbook.xml").
 * exceljs non gestisce nessuno dei tre, quindi normalizziamo il pacchetto prima di leggerlo.
 */
async function normalizePackage(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  for (const name of Object.keys(zip.files).filter((n) => /\.(xml|rels)$/.test(n))) {
    let xml = (await zip.file(name)!.async("string"))
      .replace(/^\uFEFF/, "")
      .replace(/<(\/?)x:/g, "<$1")
      .replace(/xmlns:x="/g, 'xmlns="');
    if (name.endsWith(".rels")) {
      // "xl/worksheets/_rels/sheet1.xml.rels" descrive "xl/worksheets/sheet1.xml"
      const ownerDir = posix.dirname(posix.dirname(name));
      xml = xml.replace(/Target="\/([^"]+)"/g, (_m, abs: string) => `Target="${posix.relative(ownerDir === "." ? "" : ownerDir, abs)}"`);
    }
    zip.file(name, xml);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function loadWorkbook(path: string): Promise<ExcelJS.Workbook> {
  const buffer = readFileSync(path);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await normalizePackage(buffer)) as unknown as ArrayBuffer);
  return wb;
}

export function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Foglio "${name}" non trovato`);
  return ws;
}
