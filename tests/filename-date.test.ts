import { describe, expect, it } from "vitest";
import { parseReportDate, toISODate } from "@/lib/ingestion/filename-date";

describe("report date from filename (item 2)", () => {
  it("parses UK day-first dd.mm.yy from a real report name", () => {
    const p = parseReportDate("Consumer Sentiment - Summary ReportF 01.07.26 GPT.docx");
    expect(p).toEqual({ year: 2026, month: 7, day: 1 });
    expect(toISODate(p!)).toBe("2026-07-01");
  });

  it("handles separators - _ / and 4-digit years", () => {
    expect(parseReportDate("report 4-3-2020.docx")).toEqual({ year: 2020, month: 3, day: 4 });
    expect(parseReportDate("wave_15_11_22 final.docx")).toEqual({ year: 2022, month: 11, day: 15 });
    expect(parseReportDate("CS 09/06/25.docx")).toEqual({ year: 2025, month: 6, day: 9 });
  });

  it("handles ISO year-first", () => {
    expect(parseReportDate("2020-03-23 sentiment.docx")).toEqual({ year: 2020, month: 3, day: 23 });
  });

  it("handles month-name dates with and without a day", () => {
    expect(parseReportDate("Summary 1st July 2026.docx")).toEqual({ year: 2026, month: 7, day: 1 });
    expect(parseReportDate("Consumer Sentiment March 2021.docx")).toEqual({ year: 2021, month: 3, day: null });
  });

  it("returns null when there is no readable date", () => {
    expect(parseReportDate("final report GPT.docx")).toBeNull();
    expect(parseReportDate("notes.docx")).toBeNull();
  });

  it("rejects impossible day/month values rather than mis-parsing", () => {
    // 45 is not a valid day; should not match as a date
    expect(parseReportDate("code 45.99.99 draft.docx")).toBeNull();
  });
});
