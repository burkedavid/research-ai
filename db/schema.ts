import { sql } from "drizzle-orm";
import {
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
  },
  (t) => [primaryKey({ columns: [t.chunkId, t.themeId] })],
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
