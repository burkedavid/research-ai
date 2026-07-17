import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { segments } from "@/db/schema";
import type { SessionUser } from "@/lib/errors";

export interface ThemeFrequency {
  themeName: string;
  chunkCount: number;
  interviewCount: number;
}

export interface ThemeTimelinePoint {
  wave: string;
  themeName: string;
  chunkCount: number;
}

export interface WordFrequency {
  word: string;
  count: number;
}

const STOPWORDS = new Set(
  "the a an and or but if then than that this these those i we you they he she it my our your their his her its is are was were be been being have has had do does did will would could should can may might must not no nor so to of in on at by for with about against between into through during before after above below from up down out off over under again further once here there when where why how all any both each few more most other some such only own same too very just dont im ive its thats weve youre theyre".split(
    " ",
  ),
);

/** Segment Observatory data (§B8): frequencies carry counts so the UI can
 *  show small-n caveats; verbatim respects the transcript ACL. */
export async function getSegmentProfile(user: SessionUser, segmentId: string) {
  const [segment] = await db.select().from(segments).where(eq(segments.id, segmentId));
  if (!segment) return null;

  const themeFrequencies = (await db.execute(sql`
    SELECT t.name AS theme_name,
           count(DISTINCT c.id)::int AS chunk_count,
           count(DISTINCT c.interview_id)::int AS interview_count
    FROM chunk_themes ct
    JOIN chunks c ON c.id = ct.chunk_id
    JOIN documents d ON d.id = c.document_id
    JOIN themes t ON t.id = ct.theme_id
    WHERE c.segment_id = ${segmentId}
      AND d.status = 'indexed'
      ${user.transcriptAccess ? sql`` : sql`AND d.source_type <> 'transcript'`}
    GROUP BY t.name
    ORDER BY chunk_count DESC
    LIMIT 20
  `)) as unknown as { theme_name: string; chunk_count: number; interview_count: number }[];

  const timeline = (await db.execute(sql`
    SELECT w.year || '-' || lpad(w.month::text, 2, '0') AS wave,
           t.name AS theme_name,
           count(DISTINCT c.id)::int AS chunk_count
    FROM chunk_themes ct
    JOIN chunks c ON c.id = ct.chunk_id
    JOIN documents d ON d.id = c.document_id
    JOIN waves w ON w.id = c.wave_id
    JOIN themes t ON t.id = ct.theme_id
    WHERE c.segment_id = ${segmentId}
      AND d.status = 'indexed'
      ${user.transcriptAccess ? sql`` : sql`AND d.source_type <> 'transcript'`}
    GROUP BY w.year, w.month, t.name
    ORDER BY w.year, w.month
  `)) as unknown as { wave: string; theme_name: string; chunk_count: number }[];

  // recent verbatim: latest-wave consumer turns (ACL enforced in SQL)
  const verbatim = user.transcriptAccess
    ? ((await db.execute(sql`
        SELECT c.id AS chunk_id, c.content, c.document_id,
               i.external_ref AS interview_ref,
               w.year || '-' || lpad(w.month::text, 2, '0') AS wave
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        JOIN waves w ON w.id = c.wave_id
        LEFT JOIN interviews i ON i.id = c.interview_id
        WHERE c.segment_id = ${segmentId}
          AND d.status = 'indexed'
          AND d.source_type = 'transcript'
          AND c.evidence_type = 'direct_quote'
        ORDER BY w.year DESC, w.month DESC, c.seq
        LIMIT 8
      `)) as unknown as { chunk_id: string; content: string; document_id: string; interview_ref: string | null; wave: string }[])
    : [];

  // consumer language for the word cloud (transcript-gated)
  const wordCounts = new Map<string, number>();
  for (const row of verbatim) {
    const consumerText = row.content
      .split("\n")
      .filter((l) => l.startsWith("CONSUMER:"))
      .join(" ");
    for (const raw of consumerText.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)) {
      if (raw.length < 4 || STOPWORDS.has(raw) || raw === "consumer") continue;
      wordCounts.set(raw, (wordCounts.get(raw) ?? 0) + 1);
    }
  }
  const words: WordFrequency[] = [...wordCounts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 60);

  return {
    segment: { id: segment.id, name: segment.name, description: segment.description },
    themeFrequencies: themeFrequencies.map((r) => ({
      themeName: r.theme_name,
      chunkCount: Number(r.chunk_count),
      interviewCount: Number(r.interview_count),
    })),
    timeline: timeline.map((r) => ({ wave: r.wave, themeName: r.theme_name, chunkCount: Number(r.chunk_count) })),
    verbatim: verbatim.map((r) => {
      const firstConsumerLine = r.content.split("\n").find((l) => l.startsWith("CONSUMER:"));
      return {
        chunkId: r.chunk_id,
        documentId: r.document_id,
        quote: (firstConsumerLine ?? r.content).replace(/^CONSUMER:\s*/, ""),
        interviewRef: r.interview_ref,
        wave: r.wave,
      };
    }),
    words,
  };
}
