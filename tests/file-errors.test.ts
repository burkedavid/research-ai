import { describe, expect, it } from "vitest";
import { adviceForStoredError, checkFileSignature, explainParseError } from "@/lib/ingestion/file-errors";

/** The real signature of a Word 97-2003 .doc — an OLE compound document. */
const OLE_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

describe("mislabelled uploads are caught and explained", () => {
  it("rejects a .doc renamed to .docx — the failure seen in production", () => {
    const problem = checkFileSignature("July 2026.docx", Buffer.concat([OLE_HEADER, Buffer.alloc(64)]));
    expect(problem?.code).toBe("legacy_office_format");
    expect(problem?.message).toContain("July 2026.docx");
    expect(problem?.message).toContain(".doc");
    // the whole point: it says what to do, in Word's own menu wording
    expect(problem?.advice).toMatch(/Save As/i);
    // and never leaks the library's own words
    expect(`${problem?.message} ${problem?.advice}`).not.toMatch(/central directory|zip/i);
  });

  it("accepts a genuine docx/pptx/xlsx", () => {
    for (const name of ["report.docx", "deck.pptx", "data.xlsx"]) {
      expect(checkFileSignature(name, Buffer.concat([ZIP_HEADER, Buffer.alloc(64)]))).toBeNull();
    }
  });

  it("names the specific wrong format so the fix is obvious", () => {
    expect(checkFileSignature("notes.docx", Buffer.from("{\\rtf1\\ansi"))?.code).toBe("rtf_renamed");
    expect(checkFileSignature("page.docx", Buffer.from("<html><body>hi"))?.code).toBe("html_renamed");
    expect(checkFileSignature("empty.docx", Buffer.alloc(0))?.code).toBe("empty_file");
    expect(checkFileSignature("scan.pdf", Buffer.from("not a pdf"))?.code).toBe("not_a_pdf");
  });

  it("leaves formats it does not police alone", () => {
    expect(checkFileSignature("transcript.txt", Buffer.from("MOD: hello"))).toBeNull();
    expect(checkFileSignature("subs.vtt", Buffer.from("WEBVTT"))).toBeNull();
    expect(checkFileSignature("real.pdf", Buffer.from("%PDF-1.7"))).toBeNull();
  });

  it("translates the raw jszip error if a bad file reaches the parser", () => {
    const raw = new Error("Can't find end of central directory : is this a zip file ?");
    const problem = explainParseError(raw, "July 2026.docx");
    expect(problem.code).toBe("not_a_zip");
    expect(problem.message).not.toMatch(/central directory/i);
    expect(problem.message).toContain("July 2026.docx");
  });

  it("passes an unrecognised error through instead of inventing a diagnosis", () => {
    const problem = explainParseError(new Error("socket hang up"), "a.docx");
    expect(problem.code).toBe("unknown");
    expect(problem.advice).toContain("socket hang up");
  });

  it("re-derives advice from a message already stored on the document", () => {
    const stored = explainParseError(
      new Error("Can't find end of central directory : is this a zip file ?"),
      "July 2026.docx",
    ).message;
    expect(adviceForStoredError(stored)).toMatch(/Save As/i);
    expect(adviceForStoredError("something else entirely")).toBeNull();
  });
});
