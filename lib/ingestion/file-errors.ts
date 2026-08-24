/**
 * Turning file problems into something a researcher can act on.
 *
 * The parsers are third-party libraries and their errors are written for
 * developers: a .doc renamed to .docx produced
 *   "Can't find end of central directory : is this a zip file ?"
 * on the wave page, which tells a researcher nothing and hides a problem they
 * could fix in thirty seconds in Word.
 */

export type FileProblemCode =
  | "not_a_zip"
  | "legacy_office_format"
  | "rtf_renamed"
  | "html_renamed"
  | "not_a_pdf"
  | "empty_file"
  | "password_protected"
  | "no_text"
  | "unknown";

export interface FileProblem {
  code: FileProblemCode;
  /** one sentence saying what is wrong, stored in documents.error */
  message: string;
  /** what to do about it, shown under the message */
  advice: string;
}

const ZIP_EXTENSIONS = ["docx", "pptx", "xlsx"];
const OFFICE_NAME: Record<string, string> = { docx: "Word", pptx: "PowerPoint", xlsx: "Excel" };
const LEGACY_EXT: Record<string, string> = { docx: ".doc", pptx: ".ppt", xlsx: ".xls" };

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((b, i) => buffer[i] === b);
}

/**
 * Check a file really is what its extension claims, BEFORE it is stored and
 * queued for ingestion. Catching it here means the person who uploaded it is
 * still sitting in front of the dialog, rather than finding a failed row later.
 */
export function checkFileSignature(filename: string, buffer: Buffer): FileProblem | null {
  const ext = extensionOf(filename);

  if (buffer.length === 0) {
    return {
      code: "empty_file",
      message: `"${filename}" is empty — it contains no data at all.`,
      advice: "Check the file opens on your machine, then upload it again. A zero-byte file usually means a failed copy or sync.",
    };
  }

  if (ZIP_EXTENSIONS.includes(ext)) {
    // Every modern Office file is a zip archive; these all start "PK".
    if (startsWith(buffer, [0x50, 0x4b])) return null;

    const app = OFFICE_NAME[ext];
    const legacy = LEGACY_EXT[ext];

    // D0 CF 11 E0 — the old OLE compound-document format
    if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0])) {
      return {
        code: "legacy_office_format",
        message: `"${filename}" is an old-format ${legacy} file that has been renamed to .${ext}.`,
        advice: `${app} opens it happily, which is why it looks fine on your machine, but it cannot be read as a .${ext}. Open it in ${app} and use File → Save As → ${app} Document (.${ext}), then upload the saved copy.`,
      };
    }
    if (startsWith(buffer, [0x7b, 0x5c, 0x72, 0x74, 0x66])) {
      return {
        code: "rtf_renamed",
        message: `"${filename}" is a Rich Text (.rtf) file that has been renamed to .${ext}.`,
        advice: `Open it in ${app} and use File → Save As → ${app} Document (.${ext}), then upload the saved copy.`,
      };
    }
    if (startsWith(buffer, [0x3c])) {
      return {
        code: "html_renamed",
        message: `"${filename}" is an HTML or XML file that has been renamed to .${ext}.`,
        advice: `This usually happens when a document is saved from a web page or an email. Open it in ${app} and use File → Save As → ${app} Document (.${ext}), then upload the saved copy.`,
      };
    }
    return {
      code: "not_a_zip",
      message: `"${filename}" is not a readable .${ext} file.`,
      advice: `A .${ext} is a specific format, not just an extension. Open the file in ${app} and use File → Save As → ${app} Document (.${ext}), then upload the saved copy.`,
    };
  }

  if (ext === "pdf" && !startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) {
    return {
      code: "not_a_pdf",
      message: `"${filename}" is not a readable PDF.`,
      advice: "Open it and re-save or re-export it as a PDF, then upload the saved copy.",
    };
  }

  return null;
}

/**
 * Translate whatever a parser threw into the same shape, so a failure that
 * slips past the upload check still reads as English on the wave page.
 * Safe to run on an already-friendly stored message: the patterns below match
 * the raw library text, and anything unrecognised is passed through unchanged.
 */
export function explainParseError(err: unknown, filename: string): FileProblem {
  const raw = err instanceof Error ? err.message : String(err);

  if (/end of central directory|is this a zip file|corrupted zip|invalid signature/i.test(raw)) {
    return {
      code: "not_a_zip",
      message: `"${filename}" could not be opened — it is not a valid Office file, despite its extension.`,
      advice:
        "It is most likely an old-format .doc/.xls/.ppt, an RTF, or a web page that was renamed rather than saved in the modern format. Open it in Office and use File → Save As to save a real copy, then upload that.",
    };
  }
  if (/password|encrypted/i.test(raw)) {
    return {
      code: "password_protected",
      message: `"${filename}" is password-protected, so its contents cannot be read.`,
      advice: "Remove the password in Office (File → Info → Protect Document), save a copy, and upload that.",
    };
  }
  if (/No content could be extracted/i.test(raw)) {
    return {
      code: "no_text",
      message: `No text could be read from "${filename}".`,
      advice:
        "If it is a scanned document, run it through OCR first. If it is a PDF of images, supply the original document instead.",
    };
  }

  return {
    code: "unknown",
    message: `"${filename}" could not be processed.`,
    advice: `The extraction step reported: ${raw.replace(/^Error:\s*/, "")}. Check the file opens correctly, try re-saving it, and contact an administrator if it keeps failing.`,
  };
}

/** Re-derive the advice for a message already stored in documents.error. */
export function adviceForStoredError(stored: string): string | null {
  if (/not a valid Office file|not a readable|old-format|Rich Text|HTML or XML/i.test(stored)) {
    return "Open the file in Office and use File → Save As to save a real copy in the modern format, then upload that copy. Renaming a file does not change its format.";
  }
  if (/password-protected/i.test(stored)) {
    return "Remove the password in Office (File → Info → Protect Document), save a copy, and upload that.";
  }
  if (/No text could be read|No content could be extracted/i.test(stored)) {
    return "If it is a scanned document, run it through OCR first, or supply the original document.";
  }
  if (/is empty/i.test(stored)) {
    return "Check the file opens on your machine, then upload it again.";
  }
  return null;
}
