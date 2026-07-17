import * as XLSX from "xlsx";
import type { ParsedBlock, ParseResult, ParseWarning } from "./types";

/**
 * Excel/CSV parser (§B6.1): each row becomes "Header: value; ..." text so
 * sample information and coding frames are retrievable via keyword search.
 */
export function parseTabular(buffer: Buffer, filename: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const blocks: ParsedBlock[] = [];

  const workbook = XLSX.read(buffer, { type: "buffer" });
  if (workbook.SheetNames.length === 0) {
    warnings.push({ code: "no_text_extracted", message: `No sheets found in ${filename}.` });
    return { blocks, warnings };
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length === 0) continue;

    // group rows so a chunk holds several related rows, not one row each
    const ROWS_PER_BLOCK = 10;
    for (let i = 0; i < rows.length; i += ROWS_PER_BLOCK) {
      const slice = rows.slice(i, i + ROWS_PER_BLOCK);
      const text = slice
        .map((row) =>
          Object.entries(row)
            .filter(([, v]) => String(v).trim() !== "")
            .map(([k, v]) => `${k}: ${String(v).trim()}`)
            .join("; "),
        )
        .filter(Boolean)
        .join("\n");
      if (text) {
        blocks.push({
          text,
          sectionPath: sheetName,
          pageRef: `${sheetName} rows ${i + 1}–${Math.min(i + ROWS_PER_BLOCK, rows.length)}`,
          style: "body",
        });
      }
    }
  }

  if (blocks.length === 0) {
    warnings.push({ code: "no_text_extracted", message: `No data rows found in ${filename}.` });
  }
  return { blocks, warnings };
}
