import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  chunkThemes,
  taggingRunCandidates,
  taxonomyRevisions,
  themeTaggingRuns,
  themes,
} from "@/db/schema";
import { recordAiUsage } from "@/lib/ai-usage";
import { audit } from "@/lib/audit";
import { estimateGbp } from "@/lib/config";
import { getEmbeddings } from "@/lib/embeddings";
import { ForbiddenError, type SessionUser } from "@/lib/errors";
import { getUsdToGbp } from "@/lib/fx";
import { env } from "@/lib/env";
import { getLlm } from "@/lib/llm";
import { resolveModel } from "@/lib/services/model-settings";
import { generateObject } from "ai";

/**
 * Applying a newly-added theme to an already-indexed archive.
 *
 * Adding a theme only ever affected FUTURE uploads, so a theme added after a
 * back-catalogue import sat at zero passages for ever. This closes that without
 * a full re-sweep: a run is scoped to ONE theme and only ever INSERTs rows for
 * that theme, so it cannot disturb any other theme's historical counts — which
 * a non-deterministic model doing a blanket re-tag certainly would.
 *
 * Invariants worth keeping:
 *  - source='human' rows are recorded researcher judgements and are never
 *    touched, read or overwritten here.
 *  - candidates are chosen WITHOUT the caller's ACL and WITHOUT the answer-time
 *    re-ranker. That re-ranker boosts recency and suppresses repeat voices,
 *    which is right for answering a question and wrong for deciding a theme's
 *    historical evidence base.
 *  - a run that hits its cap is 'truncated', never 'complete'. Coverage claims
 *    must be falsifiable.
 */

/**
 * How far past the closest passage to keep looking, as a cosine distance.
 *
 * Deliberately RELATIVE, not an absolute ceiling. Absolute thresholds are a
 * property of the embedding model, not of relevance: the dev hash embeddings
 * put genuinely-related passages at 0.49-0.70, where Voyage or OpenAI would put
 * them somewhere else entirely. A fixed number therefore selects sensibly for
 * one provider and nothing at all for another — and a run that selects nothing
 * would declare a theme "covered" having read not one passage.
 *
 * Over-selecting is cheap to be wrong about: the model adjudicates every
 * candidate, so a loose band costs money (shown before anyone commits) but
 * cannot produce a wrong tag. Under-selecting silently loses evidence. So the
 * band is generous by design — embeddings do recall here, the model does
 * precision.
 */
export const CANDIDATE_BAND = 0.15;
/** Runaway guard. Hitting it marks the run truncated rather than complete. */
export const MAX_CANDIDATES = 4000;
/** Passages adjudicated per batch. */
export const RETAG_BATCH_SIZE = 20;

export interface ThemeCoverage {
  themeId: string;
  themeName: string;
  taggedPassages: number;
  runStatus: string | null;
  runId: string | null;
  candidatesTotal: number;
  candidatesDone: number;
  tagsAdded: number;
  estCostGbp: number | null;
  /** true when this theme's tagging does not cover the whole archive */
  incomplete: boolean;
}

async function requireAdmin(user: SessionUser): Promise<void> {
  if (user.role !== "admin") throw new ForbiddenError("Requires admin role");
}

/** Current taxonomy version: max(id) of the append-only revision log. */
export async function currentTaxonomyVersion(): Promise<number> {
  const [row] = await db
    .select({ v: sql<number>`coalesce(max(${taxonomyRevisions.id}), 0)::int` })
    .from(taxonomyRevisions);
  return Number(row?.v ?? 0);
}

/**
 * Which themes do not yet cover the archive.
 *
 * A theme is "incomplete" if it has never had a completed run AND was created
 * after the earliest indexed document — i.e. the archive was indexed without it
 * in the taxonomy, so its zero (or partial) count is an artefact of when it was
 * defined rather than a finding.
 */
export async function getThemeCoverage(): Promise<ThemeCoverage[]> {
  const rows = (await db.execute(sql`
    WITH first_doc AS (SELECT min(created_at) AS at FROM documents WHERE status = 'indexed'),
    latest_run AS (
      SELECT DISTINCT ON (theme_id) theme_id, id, status, candidates_total, candidates_done,
             tags_added, est_cost_gbp
      FROM theme_tagging_runs ORDER BY theme_id, created_at DESC
    )
    SELECT t.id, t.name,
           t.created_at > coalesce((SELECT at FROM first_doc), t.created_at) AS added_late,
           (SELECT count(*)::int FROM chunk_themes ct WHERE ct.theme_id = t.id) AS tagged,
           r.id AS run_id, r.status AS run_status, r.candidates_total, r.candidates_done,
           r.tags_added, r.est_cost_gbp,
           -- a completed run that examined no passages proves nothing, so it
           -- does not count as coverage
           EXISTS (
             SELECT 1 FROM theme_tagging_runs x
             WHERE x.theme_id = t.id AND x.status = 'complete' AND x.candidates_total > 0
           ) AS ever_complete
    FROM themes t
    LEFT JOIN latest_run r ON r.theme_id = t.id
    WHERE t.status = 'active'
    ORDER BY t.name
  `)) as unknown as Record<string, unknown>[];

  return rows.map((r) => ({
    themeId: String(r.id),
    themeName: String(r.name),
    taggedPassages: Number(r.tagged ?? 0),
    runStatus: (r.run_status as string | null) ?? null,
    runId: (r.run_id as string | null) ?? null,
    candidatesTotal: Number(r.candidates_total ?? 0),
    candidatesDone: Number(r.candidates_done ?? 0),
    tagsAdded: Number(r.tags_added ?? 0),
    estCostGbp: r.est_cost_gbp != null ? Number(r.est_cost_gbp) : null,
    incomplete: Boolean(r.added_late) && !r.ever_complete,
  }));
}

/** Theme ids whose tagging does not cover the archive — for coverage caveats. */
export async function incompleteThemeNames(): Promise<Set<string>> {
  const coverage = await getThemeCoverage();
  return new Set(coverage.filter((c) => c.incomplete).map((c) => c.themeName));
}

/**
 * Select the passages worth asking about, and price the run — WITHOUT spending
 * anything beyond one embedding of the theme description. Nothing is charged to
 * an LLM until someone explicitly starts the run.
 */
export async function planThemeRun(user: SessionUser, themeId: string, ip?: string | null) {
  await requireAdmin(user);
  const [theme] = await db.select().from(themes).where(eq(themes.id, themeId));
  if (!theme) throw new Error("Theme not found");
  if (theme.status !== "active") throw new Error("Cannot apply a merged theme");

  // an in-flight run must not be duplicated — that would pay twice
  const [live] = await db
    .select()
    .from(themeTaggingRuns)
    .where(and(eq(themeTaggingRuns.themeId, themeId), eq(themeTaggingRuns.status, "running")));
  if (live) return { runId: live.id, candidates: live.candidatesTotal, estCostGbp: Number(live.estCostGbp ?? 0) };

  const embeddings = getEmbeddings();
  const description = theme.definition?.trim() ? `${theme.name}: ${theme.definition.trim()}` : theme.name;
  const [vector] = await embeddings.embed([description], "query");
  await recordAiUsage({
    kind: "embedding",
    model: embeddings.model,
    feature: "retag",
    inputTokens: embeddings.lastTokens(),
    userId: user.id,
  });
  const literal = `[${vector.join(",")}]`;

  // No ACL and no re-ranking: this is a system job deciding a theme's evidence
  // base, not a user asking a question.
  const candidates = (await db.execute(sql`
    WITH scored AS (
      SELECT c.id, c.token_count, (c.embedding <=> ${literal}::vector) AS distance
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.status = 'indexed'
        AND c.embedding IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM chunk_themes ct WHERE ct.chunk_id = c.id AND ct.theme_id = ${themeId}
        )
    )
    SELECT id, token_count, distance FROM scored
    WHERE distance <= (SELECT min(distance) FROM scored) + ${CANDIDATE_BAND}
    ORDER BY distance
    LIMIT ${MAX_CANDIDATES}
  `)) as unknown as { id: string; token_count: number; distance: number }[];

  const [{ model: llmModel }] = [getLlm("ingestion", await resolveModel("ingestion"))].map((l) => ({
    model: l.modelId,
  }));
  const promptTokens = candidates.reduce((n, c) => n + Number(c.token_count ?? 0), 0);
  const fx = await getUsdToGbp();
  // output is a short verdict per passage; ~12 tokens each is generous
  const estGbp = estimateGbp(llmModel, promptTokens, candidates.length * 12, fx.rate) ?? 0;

  const [run] = await db
    .insert(themeTaggingRuns)
    .values({
      themeId,
      status: "pending",
      taxonomyVersion: await currentTaxonomyVersion(),
      threshold: CANDIDATE_BAND,
      embeddingModel: embeddings.model,
      llmModel,
      candidatesTotal: candidates.length,
      estCostGbp: String(estGbp),
      requestedBy: user.id,
    })
    .returning();

  if (candidates.length > 0) {
    await db
      .insert(taggingRunCandidates)
      .values(candidates.map((c) => ({ runId: run.id, chunkId: c.id, distance: Number(c.distance) })))
      .onConflictDoNothing();
  }

  await audit({
    userId: user.id,
    action: "theme_edit",
    entityType: "theme",
    entityId: themeId,
    detail: { op: "retag_planned", theme: theme.name, candidates: candidates.length, estCostGbp: estGbp },
    ip,
  });

  return { runId: run.id, candidates: candidates.length, estCostGbp: estGbp };
}

/**
 * Deterministic stand-in for the model in dev and tests, mirroring the fake
 * branch in suggestMetadata. Matches on shared meaningful words between the
 * theme description and the passage, so the whole run path — candidates,
 * batching, tag writes, provenance, coverage — is exercised without a key.
 */
const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","they","their","about","have","has","are","was","were",
  "consumers","consumer","people","talking","describing","discussing","said","says","when","what","which",
  "into","over","than","them","then","there","would","could","also","very","just","only","more","most",
]);

function heuristicApplies(themeDescription: string, content: string): boolean {
  const terms = new Set(
    themeDescription
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
  if (terms.size === 0) return false;
  const text = ` ${content.toLowerCase()} `;
  let hits = 0;
  for (const t of terms) if (text.includes(t)) hits += 1;
  return hits >= 1;
}

const verdictSchema = z.object({
  verdicts: z.array(z.object({ ref: z.number(), applies: z.boolean() })),
});

/**
 * Adjudicate one bounded batch. Returns how many candidates remain, so the
 * caller (Inngest step or inline loop) can drive it to completion and show
 * honest progress meanwhile.
 */
export async function retagBatch(runId: string): Promise<{ done: number; remaining: number; status: string }> {
  const [run] = await db.select().from(themeTaggingRuns).where(eq(themeTaggingRuns.id, runId));
  if (!run) throw new Error("Run not found");
  if (run.status === "complete" || run.status === "cancelled") {
    return { done: run.candidatesDone, remaining: 0, status: run.status };
  }
  const [theme] = await db.select().from(themes).where(eq(themes.id, run.themeId));
  if (!theme) throw new Error("Theme not found");

  if (run.status === "pending") {
    await db
      .update(themeTaggingRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(themeTaggingRuns.id, runId));
  }

  const batch = (await db.execute(sql`
    SELECT rc.chunk_id, c.content
    FROM tagging_run_candidates rc
    JOIN chunks c ON c.id = rc.chunk_id
    WHERE rc.run_id = ${runId} AND rc.matched IS NULL
    ORDER BY rc.distance
    LIMIT ${RETAG_BATCH_SIZE}
  `)) as unknown as { chunk_id: string; content: string }[];

  if (batch.length === 0) {
    const status = run.candidatesTotal >= MAX_CANDIDATES ? "truncated" : "complete";
    await db
      .update(themeTaggingRuns)
      .set({ status, finishedAt: new Date() })
      .where(eq(themeTaggingRuns.id, runId));
    return { done: run.candidatesDone, remaining: 0, status };
  }

  const definition = theme.definition?.trim() ? ` It is defined as: ${theme.definition.trim()}` : "";
  const prompt = [
    `You are deciding whether each passage expresses the theme "${theme.name}".${definition}`,
    "Answer for every passage by its ref number. Be strict: a passing mention is not enough,",
    "the passage must genuinely be about this theme.",
    "",
    ...batch.map((b, i) => `--- ref=${i} ---\n${b.content}`),
  ].join("\n");

  try {
    let byRef: Map<number, boolean>;
    let modelId: string;

    if (env.LLM_PROVIDER === "fake") {
      modelId = "heuristic";
      const description = `${theme.name} ${theme.definition ?? ""}`;
      byRef = new Map(batch.map((b, i) => [i, heuristicApplies(description, b.content)]));
    } else {
      const llm = getLlm("ingestion", await resolveModel("ingestion"));
      modelId = llm.modelId;
      const result = await generateObject({ model: llm.model, schema: verdictSchema, prompt });
      await recordAiUsage({
        kind: "chat",
        model: modelId,
        feature: "retag",
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      });
      byRef = new Map(result.object.verdicts.map((v) => [v.ref, v.applies]));
    }
    let added = 0;
    for (const [i, row] of batch.entries()) {
      const applies = byRef.get(i) ?? false;
      await db
        .update(taggingRunCandidates)
        .set({ matched: applies })
        .where(and(eq(taggingRunCandidates.runId, runId), eq(taggingRunCandidates.chunkId, row.chunk_id)));
      if (!applies) continue;
      // additive only, and never over a human judgement
      const inserted = await db
        .insert(chunkThemes)
        .values({
          chunkId: row.chunk_id,
          themeId: run.themeId,
          source: "ai_suggested",
          confidence: null,
          runId,
          model: modelId,
        })
        .onConflictDoNothing()
        .returning({ chunkId: chunkThemes.chunkId });
      added += inserted.length;
    }

    const [updated] = await db
      .update(themeTaggingRuns)
      .set({
        candidatesDone: run.candidatesDone + batch.length,
        tagsAdded: run.tagsAdded + added,
        llmModel: modelId,
      })
      .where(eq(themeTaggingRuns.id, runId))
      .returning();

    const remaining = updated.candidatesTotal - updated.candidatesDone;
    if (remaining <= 0) {
      const status = updated.candidatesTotal >= MAX_CANDIDATES ? "truncated" : "complete";
      await db
        .update(themeTaggingRuns)
        .set({ status, finishedAt: new Date() })
        .where(eq(themeTaggingRuns.id, runId));
      return { done: updated.candidatesDone, remaining: 0, status };
    }
    return { done: updated.candidatesDone, remaining, status: "running" };
  } catch (err) {
    await db
      .update(themeTaggingRuns)
      .set({ status: "failed", error: String(err), finishedAt: new Date() })
      .where(eq(themeTaggingRuns.id, runId));
    throw err;
  }
}

/** Live state of a run, for the progress display. */
export async function getRunStatus(runId: string) {
  const [run] = await db.select().from(themeTaggingRuns).where(eq(themeTaggingRuns.id, runId));
  if (!run) return null;
  const [theme] = await db.select().from(themes).where(eq(themes.id, run.themeId));
  const fx = await getUsdToGbp();
  return {
    id: run.id,
    themeName: theme?.name ?? "",
    status: run.status,
    candidatesTotal: run.candidatesTotal,
    candidatesDone: run.candidatesDone,
    tagsAdded: run.tagsAdded,
    estCostGbp: run.estCostGbp != null ? Number(run.estCostGbp) : null,
    error: run.error,
    fxRate: fx.rate,
  };
}

/** Runs still to finish, so a page can resume polling after a reload. */
export async function activeRuns() {
  return db
    .select({ id: themeTaggingRuns.id, themeId: themeTaggingRuns.themeId, status: themeTaggingRuns.status })
    .from(themeTaggingRuns)
    .where(sql`${themeTaggingRuns.status} IN ('pending','running')`)
    .orderBy(desc(themeTaggingRuns.createdAt));
}

export async function cancelRun(user: SessionUser, runId: string): Promise<void> {
  await requireAdmin(user);
  await db
    .update(themeTaggingRuns)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(themeTaggingRuns.id, runId), sql`${themeTaggingRuns.status} IN ('pending','running')`));
  await audit({ userId: user.id, action: "theme_edit", entityType: "theme", entityId: runId, detail: { op: "retag_cancelled" } });
}
