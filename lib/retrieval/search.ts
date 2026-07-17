import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { retrievalLog } from "@/db/schema";
import { RETRIEVAL } from "@/lib/config";
import { getEmbeddings } from "@/lib/embeddings";
import type { SessionUser } from "@/lib/errors";

export interface SearchFilters {
  waveIds?: string[];
  dateRange?: { fromYear: number; fromMonth: number; toYear: number; toMonth: number };
  segmentIds?: string[];
  themeIds?: string[];
  sourceTypes?: string[];
  evidenceTypes?: string[];
  sentiments?: string[];
  speakerRole?: string;
  projectIds?: string[];
}

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  evidenceType: string;
  speakerRole: string;
  sectionPath: string | null;
  pageRef: string | null;
  documentId: string;
  filename: string;
  sourceType: string;
  waveId: string;
  waveNumber: number;
  month: number;
  year: number;
  segmentName: string | null;
  interviewRef: string | null;
  sentiment: string | null;
  /** retrieval explainability (§B7): which legs matched and their scores */
  match: {
    semantic: boolean;
    keyword: boolean;
    semanticRank: number | null;
    keywordRank: number | null;
    similarity: number | null;
    tsRank: number | null;
    rrfScore: number;
  };
}

export interface SearchResult {
  chunks: RetrievedChunk[];
  candidateCount: number;
  topRrfScore: number | null;
  weakEvidence: boolean;
  embeddingModel: string;
  filtersApplied: SearchFilters;
}

interface LegRow {
  chunk_id: string;
  content: string;
  evidence_type: string;
  speaker_role: string;
  section_path: string | null;
  page_ref: string | null;
  document_id: string;
  filename: string;
  source_type: string;
  wave_id: string;
  wave_number: number;
  month: number;
  year: number;
  segment_name: string | null;
  interview_ref: string | null;
  sentiment: string | null;
  score: number;
}

function buildWhere(filters: SearchFilters, user: SessionUser): SQL {
  const conditions: SQL[] = [
    sql`d.status = 'indexed'`,
    // ACL inside the SQL, never post-hoc (§B7, §B9.2): raw transcript
    // evidence is invisible without transcript_access
    ...(user.transcriptAccess ? [] : [sql`d.source_type <> 'transcript'`]),
  ];

  if (filters.waveIds?.length) {
    conditions.push(sql`c.wave_id IN ${sql.raw(`(${filters.waveIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",")})`)}`);
  }
  if (filters.dateRange) {
    const { fromYear, fromMonth, toYear, toMonth } = filters.dateRange;
    conditions.push(
      sql`(w.year * 100 + w.month) BETWEEN ${fromYear * 100 + fromMonth} AND ${toYear * 100 + toMonth}`,
    );
  }
  if (filters.segmentIds?.length) {
    conditions.push(sql`c.segment_id IN ${sql.raw(`(${filters.segmentIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",")})`)}`);
  }
  if (filters.themeIds?.length) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM chunk_themes ct WHERE ct.chunk_id = c.id AND ct.theme_id IN ${sql.raw(`(${filters.themeIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",")})`)})`,
    );
  }
  if (filters.sourceTypes?.length) {
    conditions.push(sql`d.source_type IN ${sql.raw(`(${filters.sourceTypes.map((s) => `'${s.replace(/'/g, "")}'`).join(",")})`)}`);
  }
  if (filters.evidenceTypes?.length) {
    conditions.push(sql`c.evidence_type IN ${sql.raw(`(${filters.evidenceTypes.map((s) => `'${s.replace(/'/g, "")}'`).join(",")})`)}`);
  }
  if (filters.sentiments?.length) {
    conditions.push(sql`c.sentiment IN ${sql.raw(`(${filters.sentiments.map((s) => `'${s.replace(/'/g, "")}'`).join(",")})`)}`);
  }
  if (filters.speakerRole) {
    conditions.push(sql`c.speaker_role = ${filters.speakerRole}`);
  }
  if (filters.projectIds?.length) {
    conditions.push(sql`w.project_id IN ${sql.raw(`(${filters.projectIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",")})`)}`);
  }

  return sql.join(conditions, sql` AND `);
}

const SELECT_FIELDS = sql`
  c.id AS chunk_id, c.content, c.evidence_type, c.speaker_role,
  c.section_path, c.page_ref, c.sentiment,
  d.id AS document_id, d.filename, d.source_type,
  w.id AS wave_id, w.wave_number, w.month, w.year,
  s.name AS segment_name, i.external_ref AS interview_ref
`;

const FROM_JOINS = sql`
  FROM chunks c
  JOIN documents d ON d.id = c.document_id
  JOIN waves w ON w.id = c.wave_id
  LEFT JOIN segments s ON s.id = c.segment_id
  LEFT JOIN interviews i ON i.id = c.interview_id
`;

/**
 * The one retrieval function (§B7): hybrid vector + keyword search with
 * metadata filters and ACL enforced inside the SQL, fused with RRF in
 * application code so per-result provenance is available for free.
 */
export async function searchChunks(params: {
  query: string;
  filters?: SearchFilters;
  user: SessionUser;
  k?: number;
  /** persist a retrieval_log row (§B5); pass false for internal probes */
  log?: boolean;
  messageId?: string | null;
}): Promise<SearchResult> {
  const { query, user } = params;
  const filters = params.filters ?? {};
  const finalK = params.k ?? RETRIEVAL.finalK;
  const candidateK = Math.max(RETRIEVAL.candidateK, finalK);
  const where = buildWhere(filters, user);

  const embeddings = getEmbeddings();
  const [queryVector] = await embeddings.embed([query], "query");
  const vectorLiteral = `[${queryVector.join(",")}]`;

  const vectorRows = (await db.execute(sql`
    SELECT ${SELECT_FIELDS}, 1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
    ${FROM_JOINS}
    WHERE c.embedding IS NOT NULL AND ${where}
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${candidateK}
  `)) as unknown as LegRow[];

  const keywordRows = (await db.execute(sql`
    SELECT ${SELECT_FIELDS}, ts_rank(c.tsv, websearch_to_tsquery('english', ${query})) AS score
    ${FROM_JOINS}
    WHERE c.tsv @@ websearch_to_tsquery('english', ${query}) AND ${where}
    ORDER BY score DESC
    LIMIT ${candidateK}
  `)) as unknown as LegRow[];

  // reciprocal rank fusion (§B7), k = 60
  const fused = new Map<string, { row: LegRow; match: RetrievedChunk["match"] }>();
  vectorRows.forEach((row, i) => {
    fused.set(row.chunk_id, {
      row,
      match: {
        semantic: true,
        keyword: false,
        semanticRank: i + 1,
        keywordRank: null,
        similarity: Number(row.score),
        tsRank: null,
        rrfScore: 1 / (RETRIEVAL.rrfK + i + 1),
      },
    });
  });
  keywordRows.forEach((row, i) => {
    const existing = fused.get(row.chunk_id);
    if (existing) {
      existing.match.keyword = true;
      existing.match.keywordRank = i + 1;
      existing.match.tsRank = Number(row.score);
      existing.match.rrfScore += 1 / (RETRIEVAL.rrfK + i + 1);
    } else {
      fused.set(row.chunk_id, {
        row,
        match: {
          semantic: false,
          keyword: true,
          semanticRank: null,
          keywordRank: i + 1,
          similarity: null,
          tsRank: Number(row.score),
          rrfScore: 1 / (RETRIEVAL.rrfK + i + 1),
        },
      });
    }
  });

  const ranked = [...fused.values()].sort((a, b) => b.match.rrfScore - a.match.rrfScore);
  const top = ranked.slice(0, finalK);
  const topRrfScore = top[0]?.match.rrfScore ?? null;
  const weakEvidence = topRrfScore === null || topRrfScore < RETRIEVAL.weakEvidenceThreshold;

  const result: SearchResult = {
    chunks: top.map(({ row, match }) => ({
      chunkId: row.chunk_id,
      content: row.content,
      evidenceType: row.evidence_type,
      speakerRole: row.speaker_role,
      sectionPath: row.section_path,
      pageRef: row.page_ref,
      documentId: row.document_id,
      filename: row.filename,
      sourceType: row.source_type,
      waveId: row.wave_id,
      waveNumber: Number(row.wave_number),
      month: Number(row.month),
      year: Number(row.year),
      segmentName: row.segment_name,
      interviewRef: row.interview_ref,
      sentiment: row.sentiment,
      match,
    })),
    candidateCount: fused.size,
    topRrfScore,
    weakEvidence,
    embeddingModel: embeddings.model,
    filtersApplied: filters,
  };

  if (params.log !== false) {
    // no raw chunk content stored (§B5 retrieval_log)
    await db.insert(retrievalLog).values({
      messageId: params.messageId ?? null,
      userId: user.id,
      queryHash: createHash("sha256").update(query).digest("hex").slice(0, 32),
      filters: filters as Record<string, unknown>,
      candidateCount: fused.size,
      topRrfScore,
      weakEvidence,
    });
  }

  return result;
}
