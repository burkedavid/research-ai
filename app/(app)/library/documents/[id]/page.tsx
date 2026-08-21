import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviews, segments, themes } from "@/db/schema";
import { ForbiddenError } from "@/lib/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getDocumentWithChunks } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";
import { ReviewEditor } from "./review-editor";

/** What each warning actually means for the reviewer, and what to do about it. */
const WARNING_ADVICE: Record<string, string> = {
  no_text_extracted:
    "Nothing was read from this file. Reject it and re-save the source as a normal .docx, or upload a text version.",
  possible_scanned_pdf:
    "This looks like a scanned image rather than selectable text. Run it through OCR, or supply the original document.",
  ambiguous_speaker:
    "Speaker labels could not be identified, so passages may be attributed to the wrong person. Set 'Who is speaking' on each passage below before approving.",
  unreadable_region:
    "Part of the document could not be read cleanly. Compare the passages below against the original and correct any that are wrong.",
  unsupported_content:
    "This file type cannot be parsed. Reject it and re-upload in a supported format (docx, pptx, xlsx, csv, pdf, txt, vtt).",
};
const GENERIC_ADVICE = "Compare the passages below against the original and correct anything that looks wrong.";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chunk?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { chunk: highlightChunkId } = await searchParams;

  let data: Awaited<ReturnType<typeof getDocumentWithChunks>>;
  try {
    data = await getDocumentWithChunks(user, id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return (
        <div className="p-4 sm:p-6 lg:p-8">
          <Alert variant="destructive">
            <AlertDescription>
              This document contains raw transcript material and your account does not have transcript access.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    throw err;
  }
  if (!data) notFound();
  const { document, chunks } = data;

  const [allSegments, activeThemes, waveInterviews] = await Promise.all([
    db.select().from(segments).orderBy(segments.name),
    db.select().from(themes).where(eq(themes.status, "active")).orderBy(themes.name),
    db.select().from(interviews).where(eq(interviews.waveId, document.waveId)),
  ]);

  const canEdit = user.role !== "viewer" && document.status === "review";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href={`/library/waves/${document.waveId}`} className="text-sm text-slate-500 underline">
        ← Wave
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-brand-900">{document.filename}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {document.sourceType.replace(/_/g, " ")} · v{document.version} · status: {document.status}
            {document.reportDate ? ` · report date: ${document.reportDate}` : ""}
          </p>
        </div>
        <a
          href={`/api/documents/${document.id}/file`}
          target="_blank"
          className={buttonVariants({ variant: "outline" })}
        >
          Open original
        </a>
      </div>

      {Array.isArray(document.parseWarnings) && document.parseWarnings.length > 0 && (
        <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>
            Extraction warnings ({(document.parseWarnings as unknown[]).length}) — worth a look before you approve
          </AlertTitle>
          <AlertDescription className="text-amber-900">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {(document.parseWarnings as { code?: string; message: string }[]).map((w, i) => (
                <li key={i}>
                  {w.message}
                  <span className="block text-xs opacity-90">{WARNING_ADVICE[w.code ?? ""] ?? GENERIC_ADVICE}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <ReviewEditor
        documentId={document.id}
        highlightChunkId={highlightChunkId ?? null}
        documentStatus={document.status}
        canEdit={canEdit}
        canApprove={user.role !== "viewer"}
        chunks={chunks.map((c) => ({
          id: c.id,
          seq: c.seq,
          content: c.content,
          speakerRole: c.speakerRole,
          evidenceType: c.evidenceType,
          sentiment: c.sentiment,
          sectionPath: c.sectionPath,
          pageRef: c.pageRef,
          segmentId: c.segmentId,
          interviewId: c.interviewId,
          piiSuggestions: (c.piiSuggestions as { text: string; kind: string }[] | null) ?? [],
          themes: c.themes.map((t) => ({ themeId: t.themeId, name: t.name, source: t.source, confidence: t.confidence })),
          embedded: c.embedded,
        }))}
        segments={allSegments.map((s) => ({ id: s.id, name: s.name }))}
        themes={activeThemes.map((t) => ({ id: t.id, name: t.name }))}
        interviews={waveInterviews.map((i) => ({ id: i.id, ref: i.externalRef }))}
      />
    </div>
  );
}
