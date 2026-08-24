import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const roleEnum = pgEnum("user_role", ["admin", "researcher", "viewer"]);
export const waveStatusEnum = pgEnum("wave_status", ["draft", "confirmed"]);
export const themeStatusEnum = pgEnum("theme_status", ["active", "merged"]);
export const sourceTypeEnum = pgEnum("source_type", [
  "report",
  "transcript",
  "crib_sheet",
  "moderator_notes",
  "discussion_guide",
  "debrief_deck",
  "coding_frame",
  "tabular",
  // Third-party material: published statistics, industry reports, open data.
  // NOT consumer voice from our fieldwork — excluded from qualitative counts
  // and always labelled at the point of citation (§A6.3 evidence hierarchy).
  "reference_data",
  "other",
]);
export const documentStatusEnum = pgEnum("document_status", [
  "uploaded",
  "parsing",
  "review",
  "approved",
  "indexed",
  "failed",
  "deleted",
]);
export const speakerRoleEnum = pgEnum("speaker_role", ["moderator", "consumer", "mixed", "n/a"]);
export const evidenceTypeEnum = pgEnum("evidence_type", [
  "direct_quote",
  "researcher_summary",
  "guide",
  "context",
]);
export const chunkThemeSourceEnum = pgEnum("chunk_theme_source", ["ai_suggested", "human"]);
// AI-assessed emotional tone of a chunk (F2) — an optional, caveated overlay,
// never presented as statistical prevalence.
export const sentimentEnum = pgEnum("sentiment", ["positive", "negative", "neutral", "mixed"]);
export const savedOutputKindEnum = pgEnum("saved_output_kind", [
  "answer",
  "quote_list",
  "comparison",
  "report_draft",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  entraOid: text("entra_oid").unique(),
  role: roleEnum("role").notNull().default("viewer"),
  transcriptAccess: boolean("transcript_access").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  notes: text("notes"),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  name: text("name").notNull(),
  lawfulBasis: text("lawful_basis"),
  retentionMonths: integer("retention_months"),
});

export const waves = pgTable(
  "waves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    waveNumber: integer("wave_number").notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    fieldworkNotes: text("fieldwork_notes"),
    keyEvents: text("key_events").array(),
    status: waveStatusEnum("status").notNull().default("draft"),
  },
  (t) => [uniqueIndex("waves_project_year_month_uq").on(t.projectId, t.year, t.month)],
);

export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const themes = pgTable("themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  definition: text("definition"),
  parentId: uuid("parent_id"),
  status: themeStatusEnum("status").notNull().default("active"),
  mergedInto: uuid("merged_into"),
  // "was this theme added after those documents were indexed?" was not a
  // derivable fact before these columns existed.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  definitionUpdatedAt: timestamp("definition_updated_at", { withTimezone: true }),
});

/**
 * Append-only log of every change to the controlled taxonomy.
 *
 * The taxonomy version is `max(id)` — monotone by construction, so there is no
 * read-modify-write to lose and no clock to disagree with. More usefully, the
 * rows since a given version ARE the work list: they say which themes changed,
 * which is what scoping and pricing a re-tagging run needs. A single mutable
 * "taxonomy last changed" timestamp could only ever answer yes/no.
 */
export const taxonomyRevisionKindEnum = pgEnum("taxonomy_revision_kind", [
  "create",
  "rename",
  "define",
  "merge",
  "promote",
]);

export const taxonomyRevisions = pgTable("taxonomy_revisions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  kind: taxonomyRevisionKindEnum("kind").notNull(),
  themeId: uuid("theme_id").references(() => themes.id),
  /** the theme name at the time, so history survives a later rename or merge */
  themeName: text("theme_name").notNull(),
  detail: jsonb("detail"),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Genuinely-new theme ideas the ingest AI proposes outside the controlled
// taxonomy (§A5.2 "allow new themes to emerge"). Reviewed by an admin who
// promotes a proposal into a real theme or dismisses it — the taxonomy stays
// human-governed. (F1)
export const themeProposalStatusEnum = pgEnum("theme_proposal_status", ["open", "promoted", "dismissed"]);

export const themeProposals = pgTable(
  "theme_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    rationale: text("rationale"),
    occurrences: integer("occurrences").notNull().default(1),
    status: themeProposalStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("theme_proposals_name_uq").on(t.name)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waveId: uuid("wave_id")
      .notNull()
      .references(() => waves.id),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sha256: text("sha256").notNull(),
    version: integer("version").notNull().default(1),
    supersedes: uuid("supersedes"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    // the report's actual fieldwork date, parsed from the filename (item 2);
    // day-level, so twice-weekly early reports keep their distinct date even
    // when they share a monthly wave
    reportDate: date("report_date"),
    status: documentStatusEnum("status").notNull().default("uploaded"),
    error: text("error"),
    // provenance for third-party sources (source_type='reference_data'):
    // who published it and under what licence, so attribution can be honoured
    // and redistribution rights are recorded with the document itself
    publisher: text("publisher"),
    licence: text("licence"),
    sourceUrl: text("source_url"),
    parseWarnings: jsonb("parse_warnings"),
    ingestUsage: jsonb("ingest_usage"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // dedupe (§A4.2): same content re-uploaded to the same wave is caught,
    // unless it is an explicit new version (supersedes set)
    uniqueIndex("documents_wave_sha_uq")
      .on(t.waveId, t.sha256)
      .where(sql`supersedes IS NULL AND status <> 'deleted'`),
    index("documents_status_idx").on(t.status),
  ],
);

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waveId: uuid("wave_id")
      .notNull()
      .references(() => waves.id),
    // pseudonymised: NO consumer names stored (§A13.2)
    externalRef: text("external_ref").notNull(),
    segmentId: uuid("segment_id").references(() => segments.id),
    age: integer("age"),
    gender: text("gender"),
    region: text("region"),
  },
  (t) => [uniqueIndex("interviews_wave_ref_uq").on(t.waveId, t.externalRef)],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    interviewId: uuid("interview_id").references(() => interviews.id),
    seq: integer("seq").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    speakerRole: speakerRoleEnum("speaker_role").notNull().default("n/a"),
    evidenceType: evidenceTypeEnum("evidence_type").notNull(),
    // AI-assessed emotional tone (F2); NULL until assessed. Indicative only.
    sentiment: sentimentEnum("sentiment"),
    sectionPath: text("section_path"),
    pageRef: text("page_ref"),
    // region of an attributed report quote, e.g. "North" (item 3)
    region: text("region"),
    segmentId: uuid("segment_id").references(() => segments.id),
    waveId: uuid("wave_id")
      .notNull()
      .references(() => waves.id),
    embedding: vector("embedding", { dimensions: 1024 }),
    // LLM-flagged possible PII spans awaiting human confirmation (§B6.3);
    // cleared when the reviewer accepts/dismisses them at the gate
    piiSuggestions: jsonb("pii_suggestions"),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english', content)`),
  },
  (t) => [
    index("chunks_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunks_tsv_gin").using("gin", t.tsv),
    index("chunks_filter_idx").on(t.waveId, t.segmentId, t.evidenceType),
    index("chunks_document_idx").on(t.documentId),
  ],
);

export const chunkThemes = pgTable(
  "chunk_themes",
  {
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id),
    source: chunkThemeSourceEnum("source").notNull(),
    // suggestion-pass confidence; human tags = NULL (authoritative)
    confidence: real("confidence"),
    // Provenance. Without these, "when was this passage tagged, by which model,
    // under which definition?" is unanswerable — and the answer only gets more
    // unanswerable the longer the columns are missing, since every tag written
    // meanwhile has no origin. `messages` already carries this discipline.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** the tagging run that wrote this row; NULL for ingest-time and human tags */
    runId: uuid("run_id"),
    /** model that produced an ai_suggested row; NULL for human tags */
    model: text("model"),
  },
  (t) => [primaryKey({ columns: [t.chunkId, t.themeId] })],
);

/**
 * A recorded attempt to apply ONE theme to the existing archive.
 *
 * The unit of work is (theme x scope), not (chunk). A per-chunk staleness marker
 * could only say "re-read everything", and a full re-sweep would rewrite
 * ai_suggested tags for themes nobody changed — with a non-deterministic model
 * that silently reshuffles historical theme counts, which is fatal for a
 * longitudinal archive. A theme-scoped run only ever INSERTs rows for its own
 * theme, so it is monotone, idempotent and safe to resume.
 *
 * Status matters beyond bookkeeping: a theme whose run is incomplete is tagged
 * on some waves and not others, and must be caveated wherever it is counted.
 */
export const taggingRunStatusEnum = pgEnum("tagging_run_status", [
  "pending",
  "running",
  "complete",
  "truncated",
  "failed",
  "cancelled",
]);

export const themeTaggingRuns = pgTable(
  "theme_tagging_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
    status: taggingRunStatusEnum("status").notNull().default("pending"),
    /** taxonomy version (max taxonomy_revisions.id) this run answers for */
    taxonomyVersion: integer("taxonomy_version").notNull().default(0),
    /** cosine distance ceiling used to pick candidates — recorded so the
     *  coverage claim is reproducible and falsifiable */
    threshold: real("threshold").notNull(),
    embeddingModel: text("embedding_model"),
    llmModel: text("llm_model"),
    candidatesTotal: integer("candidates_total").notNull().default(0),
    candidatesDone: integer("candidates_done").notNull().default(0),
    tagsAdded: integer("tags_added").notNull().default(0),
    /** pre-run estimate shown before anyone commits to spending */
    estCostGbp: numeric("est_cost_gbp", { precision: 12, scale: 6 }),
    error: text("error"),
    requestedBy: uuid("requested_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("tagging_runs_theme_idx").on(t.themeId, t.status)],
);

/** Candidate passages for a run, so it can resume exactly where it stopped
 *  rather than re-selecting (and re-paying for) work already done. */
export const taggingRunCandidates = pgTable(
  "tagging_run_candidates",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => themeTaggingRuns.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    distance: real("distance").notNull(),
    /** null until adjudicated; then whether the model said this theme applies */
    matched: boolean("matched"),
  },
  (t) => [primaryKey({ columns: [t.runId, t.chunkId] })],
);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  filters: jsonb("filters"),
  model: text("model"),
  citations: jsonb("citations"),
  promptVersion: text("prompt_version"),
  embeddingModel: text("embedding_model"),
  retrievalVersion: text("retrieval_version"),
  usage: jsonb("usage"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promptTemplates = pgTable("prompt_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  body: text("body").notNull(),
  defaultFilters: jsonb("default_filters"),
  shared: boolean("shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const retrievalLog = pgTable("retrieval_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => messages.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  queryHash: text("query_hash").notNull(),
  filters: jsonb("filters"),
  candidateCount: integer("candidate_count").notNull(),
  topRrfScore: real("top_rrf_score"),
  topRerankScore: real("top_rerank_score"),
  weakEvidence: boolean("weak_evidence").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedOutputs = pgTable("saved_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  kind: savedOutputKindEnum("kind").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  // read-only public share (F3): unguessable token, null until shared, revocable
  shareToken: text("share_token").unique(),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Small key/value store for settings an admin can change at runtime — chiefly
 * which model each job uses, so provider/model choices can be trialled without
 * a redeploy. Values are strings; callers parse.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

/**
 * Ledger of EVERY billable AI call — chat completions and embeddings alike.
 * Token counts come straight from the provider response, so they are exact;
 * the £ figure is derived from the rate table in lib/config.ts and is an
 * estimate until reconciled against the provider's own billing.
 * Insert-only, like audit_log.
 */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // "chat" | "embedding"
    kind: text("kind").notNull(),
    model: text("model").notNull(),
    // what triggered it: ask, quotes, compare, report, trends, ingest_suggest,
    // ingest_embed, search_query, reembed
    feature: text("feature").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    // USD is what the provider actually bills; £ is derived at display time
    // using the day's FX rate, so historical spend always reads in today's
    // money and can be reconciled against an invoice.
    estCostUsd: numeric("est_cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    /** @deprecated superseded by estCostUsd — kept so no history is lost */
    estCostGbp: numeric("est_cost_gbp", { precision: 12, scale: 6 }).notNull().default("0"),
    userId: uuid("user_id").references(() => users.id),
    documentId: uuid("document_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_day_idx").on(t.createdAt), index("ai_usage_feature_idx").on(t.feature, t.createdAt)],
);

// insert-only; written via audit() helper — no update/delete code path exists (§B5)
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    detail: jsonb("detail"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_action_idx").on(t.action, t.createdAt)],
);
