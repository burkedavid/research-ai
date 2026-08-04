/**
 * Extract the report date from a filename (item 2). The archive names reports
 * with the fieldwork date, e.g.
 *   "Consumer Sentiment - Summary ReportF 01.07.26 GPT.docx" -> 2026-07-01
 * Reports run since March 2020, so 2-digit years resolve to 20xx.
 *
 * Recognised, in priority order:
 *   dd.mm.yy / dd.mm.yyyy   (UK day-first, separators . - _ / or space)
 *   yyyy-mm-dd              (ISO, year-first)
 *   "1 July 2026" / "1st July 2026" / "July 2026"  (month name)
 */
export interface ReportDateParts {
  year: number;
  month: number; // 1-12
  day: number | null; // null when only month/year is known
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function normYear(y: number): number {
  if (y >= 100) return y;
  // 2-digit: reports start March 2020, so 20-99 -> 20xx, 00-19 -> 20xx too
  return 2000 + y;
}

function valid(year: number, month: number, day: number | null): boolean {
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day !== null && (day < 1 || day > 31)) return false;
  return true;
}

export function parseReportDate(filename: string): ReportDateParts | null {
  const name = filename.replace(/\.[a-z0-9]+$/i, ""); // drop extension

  // ISO year-first: 2026-07-01 / 2026.07.01
  const iso = name.match(/(?<![\d])(\d{4})[.\-_/](\d{1,2})[.\-_/](\d{1,2})(?![\d])/);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (valid(year, month, day)) return { year, month, day };
  }

  // UK day-first: 01.07.26 / 1-7-2026 / 01_07_26 / 01 07 26
  const dmy = name.match(/(?<![\d])(\d{1,2})[.\-_/ ](\d{1,2})[.\-_/ ](\d{2}|\d{4})(?![\d])/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = normYear(Number(dmy[3]));
    if (valid(year, month, day)) return { year, month, day };
  }

  // Month name: "1 July 2026", "1st July 2026", "July 2026"
  const named = name.match(/(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?([A-Za-z]{3,})\.?\s+(\d{4})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    const year = Number(named[3]);
    const day = named[1] ? Number(named[1]) : null;
    if (month && valid(year, month, day)) return { year, month, day };
  }

  return null;
}

/** yyyy-mm-dd string for a date column, or null if no day is known. */
export function toISODate(parts: ReportDateParts): string | null {
  if (parts.day === null) return null;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
