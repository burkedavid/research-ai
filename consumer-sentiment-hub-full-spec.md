# Consumer Sentiment Intelligence Hub

**Full Product Brief and Development Specification — single combined document**

| | |
|---|---|
| Document purpose | End-user vision + development specification + technology decisions |
| Initial archive | March 2020 onwards *(the original brief's header said September 2016; the body consistently said March 2020 — standardised on March 2020. Pre-2020 material, if it exists, is a data-migration task only and changes nothing architecturally)* |
| Update frequency | Monthly |
| Security priority | Critical, enterprise grade |
| Deployment target | Vercel |
| Intended build method | Claude Code, single continuous build of v1, self-verified by automated test suites |

This document is in two parts. **Part A** is the product vision and requirements — what the platform is for, who uses it, and the research standards it must uphold. **Part B** is the technical build specification — the decided technology stack, architecture, data model, pipelines, and build order and verification plan sized for Claude Code. Part A is the authority on *intent*; Part B is the authority on *implementation*. Where they appear to conflict, Part B wins for build decisions.

---

# PART A — PRODUCT VISION AND REQUIREMENTS

## A1. Executive summary

The Consumer Sentiment Intelligence Hub will be a secure, searchable research intelligence platform built around a longitudinal archive of qualitative consumer research. It will initially contain monthly consumer sentiment findings dating back to March 2020 and will be updated with new material every month.

The platform will bring together Word reports, full transcripts, crib sheets, moderator notes and other research material. Data will be tagged by Fresco segment and other relevant metadata so users can analyse how views differ by segment, theme and time period. The system allows a researcher to ask questions in natural language, retrieve the most relevant source evidence, identify patterns and changes, and generate outputs ranging from short summaries to full reports and visualisations.

The platform must feel like an experienced qualitative researcher with perfect recall of the entire archive, while maintaining strict evidence standards and enterprise grade data security.

## A2. Product vision and intended value

### A2.1 Product vision

The objective is not simply to create a chatbot or train a bespoke AI model. The objective is to create a market research intelligence system that combines a secure research archive, structured metadata, advanced search and AI assisted analysis. The system should help researchers move quickly from a broad question to a grounded answer, while preserving the context, nuance and traceability expected in qualitative research. It augments researcher judgement rather than replacing it.

### A2.2 Value to the end user

- Reduce the time needed to search historic reports and transcripts
- Make six years or more of qualitative evidence usable as a single longitudinal dataset
- Identify changes that may be missed when reviewing one month at a time
- Compare themes across Fresco segments and time periods
- Retrieve strong supporting verbatim quickly
- Create consistent first drafts of monthly, thematic and annual reports
- Produce client ready summaries, charts and presentation content
- Maintain a clear line of sight from every insight back to the original source material

## A3. End users and user needs

### A3.1 Primary users

- Qualitative researchers analysing monthly consumer sentiment
- Research directors reviewing findings and shaping the narrative
- Insight managers preparing client reports and presentations
- Business development teams creating thought leadership and pitch material
- Future client users accessing permissioned project or theme specific views *(post-v1 — see Part B)*

### A3.2 What users should be able to do

- Upload a new monthly wave without technical support
- Ask questions in normal research language
- Filter results by date, segment, theme, client, project and source type
- See both high level patterns and the underlying evidence
- Compare two or more time periods
- Generate usable outputs and edit them before export
- Save searches, reports and dashboards for future use
- Understand where every output came from and how confident the system is in the evidence

## A4. Data that will be fed into the platform

The initial data load covers research from March 2020 onwards, with new data added monthly. The design must support both a substantial historic migration and a simple repeatable monthly upload process.

### A4.1 Core data sources

- Monthly Word reports containing the final consumer sentiment findings
- Full interview transcripts, including moderator and consumer dialogue
- Crib sheets and analysis notes
- Moderator notes and interview summaries
- Discussion guides and question frameworks
- PowerPoint reports and client debrief materials
- Coding frameworks and theme lists
- Excel or CSV data where useful, including sample information and structured coding
- Other relevant contextual material, such as key events or policy changes that shaped a research wave

### A4.2 Data handling requirements

- Word, PDF, PowerPoint, Excel, CSV and common transcript formats supported
- Text extraction retains document, page, section and speaker references where possible
- Transcripts distinguish moderator questions from consumer responses
- Direct consumer quotes remain permanently separate from researcher summaries and AI generated interpretation
- Duplicate files and repeated content are identified (hash-based dedupe — see Part B)
- Historic files are versioned and never silently overwritten
- Users can correct metadata or extraction errors **before** content becomes available for analysis (the human review gate in Part B §B6 — this is a load-bearing requirement, not a nice-to-have: it is also the PII redaction point and the defence against poor extractions permanently degrading retrieval)

## A5. Data structure, metadata and tagging

Metadata is central to the success of the platform. The AI can only produce reliable comparisons if each piece of source material is consistently labelled and retrievable.

### A5.1 Priority metadata fields

| Field | Purpose | Example |
|---|---|---|
| Month and year | Wave and trend analysis | July 2026 |
| Research wave | Identifies the fieldwork wave | Wave 76 |
| Fresco segment | Core segmentation filter | Rising Metropolitans |
| Age, gender and region | Demographic comparison | Female, 44, Midlands |
| Theme | Thematic retrieval | Cost of living |
| Question or topic area | Preserves discussion context | Future outlook |
| Source type | Distinguishes evidence types | Transcript, report, crib sheet |
| Client and project | Controls access, enables project views | Client A, Consumer Sentiment |
| Interview identifier | Links evidence to an interview (pseudonymised) | RM_F_07_2026 |
| Evidence type | Separates quote, summary, interpretation | Direct quote |
| Key event context | Connects findings to external conditions | Covid restrictions, energy crisis |

### A5.2 Theme and event taxonomy

The platform supports a controlled theme taxonomy while allowing new themes to emerge. Starting themes: cost of living and inflation; energy and fuel; food shopping; savings, debt and budgeting; banks and financial services; pensions and retirement; digital banking and technology; AI and automation; trust, fairness and confidence; optimism, anxiety and resilience; NHS and public services; politics, elections and government policy; work and employment; housing; holidays and discretionary spending; Christmas and seasonal pressures.

Users can add new themes, merge duplicates, and record theme definitions so analysis remains consistent over time. Theme merges are recorded (not destructive) so historic tagging remains traceable.

## A6. How the platform works

### A6.1 AI approach

The approach is Retrieval Augmented Generation (RAG), not training a foundation model. The platform searches the private research archive, retrieves the most relevant passages, and asks an enterprise AI model to analyse only that evidence. This suits a growing monthly archive (new data needs no retraining), supports source citations and auditability, and gives strong control over what evidence is used. The concrete retrieval design is in Part B §B7.

### A6.2 Processing flow

1. User uploads reports, transcripts and supporting files
2. The platform extracts and cleans the content
3. Content is split into meaningful chunks without breaking the context of questions, answers or report sections
4. Metadata and permissions are attached to each chunk
5. **A human reviews and corrects the extraction and suggested metadata (review gate)**
6. Keyword and semantic indexes are updated on approval
7. The user submits a question or selects an analysis workflow
8. The platform retrieves relevant evidence from authorised data only
9. The AI produces a grounded response with source references
10. The user reviews, edits, saves or exports the output

### A6.3 Evidence hierarchy

- Direct transcript evidence is the primary source for verbatim and detailed consumer experience
- Final reports are the primary source for previously agreed summary findings
- Crib sheets and moderator notes provide additional context and are clearly labelled as such
- AI generated content is never presented as direct consumer evidence
- Where sources conflict, the platform shows the conflict rather than silently choosing one version

## A7. Core user journeys

### A7.1 Monthly wave upload and analysis

1. Upload the latest Word report, transcripts and supporting notes
2. Review automatically suggested metadata and themes
3. Correct any errors and confirm the wave
4. Run a monthly change analysis against the previous wave and the same month in prior years
5. Review new, growing, continuing and fading themes
6. Generate a report outline, summary paragraphs and supporting verbatim
7. Export the approved content to Word (PowerPoint export follows in a later phase)

*(The original brief numbered these steps 10–16 — corrected.)*

### A7.2 Ask the Archive

Users enter natural language questions such as:

- How have Rising Metropolitans talked about optimism since March 2020?
- What were the biggest concerns among Budgeting Elderly consumers during the energy crisis?
- Compare attitudes to banks before and after Covid
- What words do consumers use most when talking about money worries?
- How has confidence changed between 2022 and 2026?
- Which segments talk most about fairness, trust, anxiety, control or resilience?
- Pull verbatim from all waves where consumers mention cutting back
- Create a 2020 to 2026 timeline of changing consumer sentiment

The platform returns a concise answer first, followed by optional detail, supporting evidence, the filters used, and links to source material. These example questions form the seed of the golden-question regression test set (Part B §B10).

### A7.3 Compare time periods

Any two months; two years or custom ranges; pre/post Covid; before/after a Budget or major policy announcement; cost-of-living peak vs current; latest wave vs previous wave; the same theme across several historical moments.

### A7.4 Explore a Fresco segment

Current mood and outlook; financial confidence and pressures; recurring themes; behaviour changes; language and phrases used; hopes, fears and priorities; strong supporting quotes; change over time; areas where the segment differs from the wider sample.

### A7.5 Find quotes

The user selects a topic, time period and segment. The platform returns relevant direct quotes, ranked by strength and relevance, with speaker label and source link. Users can exclude moderator wording, collapse duplicate phrasing, and exclude quotes already used in a selected report.

## A8. Analysis capabilities

Longitudinal trend analysis across the full archive; theme analysis by Fresco segment; segment comparison within a wave or period; keyword and phrase frequency; changes in consumer language over time; emotional tone analysis **with visible caveats**; co-occurrence analysis of themes; emerging and fading theme detection; recurring concerns and enduring behaviours; event-based analysis (Covid, inflation, Budgets, energy crisis, elections); quote retrieval and verbatim management; consumer type and persona development within segments *(post-v1)*; comparison of researcher summaries with underlying transcript evidence; and the ability to distinguish absence of evidence from evidence that a theme is unimportant.

### A8.1 Qualitative safeguards (non-negotiable, enforced in the generation layer — Part B §B7)

- Never overstate findings from a small sample
- Frequency is never presented as statistical prevalence
- Segment differences are only highlighted when supported by enough evidence
- Contradictory and minority views remain visible
- Outputs use cautious research language: many, several, a few, appears, there is a sense
- The system states explicitly when an observation rests on a small number of consumers

## A9. Required outputs

**Short:** one paragraph summary; five key insights; one page executive briefing; what has changed this month; slide ready bullet points; segment snapshot; top ten supporting quotes; client email summary.

**Longer:** full monthly consumer sentiment report; report broken down by key topics; theme deep dive; segment by segment analysis; annual review; multi-year trend report; client specific insight paper; pen portrait / persona report *(post-v1)*; first draft of a PowerPoint narrative *(slide-ready text in v1; native .pptx post-v1)*.

**Visual:** word clouds; keyword trackers; trend timelines *(these three in v1)*; confidence heatmaps; theme maps; segment comparison grids; mood boards; sentiment charts; interactive dashboards; quote maps *(post-v1)*.

**Export:** editable Word documents; slide-ready copy; Excel/CSV for tables and coding; image export for charts and word clouds; copy to clipboard with source references retained; saved report templates with selectable tone, length and structure.

## A10. Creative and differentiated outputs (post-v1 — foundations laid in v1)

These are the platform's differentiators, and every one of them is a presentation layer over the retrieval, metadata and theme infrastructure built in v1. They are deliberately deferred, not dropped: building them before the foundations are proven is how projects of this kind fail.

1. **Consumer Mood Barometer** — monthly emotional-tone view (optimism, anxiety, resilience, uncertainty, financial pressure) with movement over time, evidence and caveats.
2. **Fresco Segment Observatory** — live per-segment profile: mood, pressures, behaviour, language, hopes, worries, changes, recent verbatim; latest-wave and full-history views. *(A basic version ships in v1.)*
3. **Quote Finder** — dedicated verbatim search. *(Ships in v1 because it is core, not decorative.)*
4. **Time Machine** — pick any two periods and see what changed, what held, and how consumer language differs.
5. **Consumer Language Dictionary** — searchable dictionary of consumer words/phrases by theme, segment, peak usage, example quotes.
6. **Story of the Year** — turns 12 waves into a coherent annual narrative with turning points and strongest evidence.
7. **What Has Changed?** — one action comparing latest month vs previous wave, recent quarter, and same period last year; flags new / growing / continuing / fading themes. *(The comparison engine behind this ships in v1.)*
8. **Early Warning Signals** — alerts when a topic or phrase rises across consecutive waves or appears in new segments.
9. **Pen Portrait and Persona Generator** — evidence-based pen portraits per segment, grounded in multiple sources, clearly distinguishing observed evidence from synthesis.
10. **Research Notebook** — a persistent workspace where researchers collect quotes, charts, searches, observations, hypotheses and draft conclusions before generating a report; mirrors how qualitative researchers actually work. (v1's saved outputs and shortlist baskets are the seed of this.)
11. **Further ideas** — theme journey maps; turning point detector; dedicated contradiction finder ("show me where consumers disagree" — within-wave polarisation and cross-segment divergence; v1's generation rules already surface contradictions inside retrieved evidence, this makes it a first-class tool); language change tracker; research gap finder; client question generator; scenario explorer; audio-style briefing scripts; interactive narrative reports; research memory ("continue from last month's report", "use the same coding framework as before"); two-stage review workflow (reviewer → second reviewer → published) for enterprise governance; usage analytics dashboards (most-searched themes, searches returning weak evidence, unused metadata, retrieval failures — all derivable from v1's audit and retrieval logs without schema change).

## A11. User interface and navigation

Five primary actions:

| Primary action | Purpose |
|---|---|
| Ask the Archive | Natural language questions, evidence-based cited answers |
| Compare Time Periods | Compare months, years or custom periods |
| Explore Segments | Fresco segment profiles and trends |
| Find Quotes | Retrieve, shortlist and export direct verbatim |
| Create Report | Generate summaries, reports and presentation content |

Supporting areas: upload and data quality review; theme and metadata management; saved searches and outputs; source document viewer; dashboards and visualisation; administration, users and permissions; security and audit log.

## A12. AI evidence standards

**Retrieval and grounding:** hybrid retrieval (exact keyword + semantic vector); metadata filters applied during retrieval; citations at paragraph/quote level; the user can open the exact source passage; generation only ever draws on data the user is authorised to access; the system shows when evidence is limited or inconclusive.

**AI generated content:** generated summaries and interpretations are clearly labelled; verbatim is never fabricated (and is **machine-verified** — Part B §B7); quote meaning is never altered; users choose exact transcript wording or lightly-edited-for-readability (edited versions are labelled); prompt, sources and model are recorded for outputs; human editing and approval precede export or client use.

**Model flexibility:** the platform is never locked to one AI provider. Retrieval, metadata and security layers are independent of the language model, so models can change as quality, cost or client requirements evolve. (Implemented via the Vercel AI SDK provider abstraction — Part B §B3.)

## A13. Data security, privacy and governance

Security is a non-negotiable design requirement. The platform will contain confidential qualitative research, potentially including personal data and material produced for regulated financial services organisations.

### A13.1 Core security principles

- Private enterprise environment, not a consumer AI account
- Client data must not be used to train public or shared AI models
- Encryption in transit and at rest
- Logical or physical separation of client datasets as required
- Least privilege access and role based permissions
- Multi factor authentication and Single Sign On
- Full audit logging: uploads, searches, source access, exports, permission changes, deletions
- Separate dev/test/prod; no live client data in development unless explicitly approved (a synthetic seed corpus exists for exactly this — Part B §B10.1)
- Secure backups, disaster recovery, tested restoration
- Configurable retention, legal hold and deletion rules
- Permanent deletion capability including derived indexes and embeddings
- Secure API authentication, key rotation, secrets management
- Vulnerability management, dependency scanning, penetration testing before client launch
- Incident response and breach notification workflow
- Regular access reviews and prompt removal of leavers

### A13.2 Privacy and personal data

- UK GDPR support and data processing agreements
- Controller/processor responsibilities defined per deployment
- Personal data minimised; interview identifiers pseudonymised (no consumer names stored in the database — Part B §B5)
- Names, contact details and precise locations flagged for redaction during ingestion (LLM-suggested, human-confirmed at the review gate)
- Raw transcript access restricted more tightly than approved summaries
- Subject access, correction and deletion workflows where applicable
- Lawful basis, retention period and client restrictions recorded per project

### A13.3 AI provider requirements

- Enterprise API/cloud services with contractual commitments that customer data is not used for general model training unless explicitly opted in
- Unnecessary provider logging and retention disabled where supported
- Data processing and storage locations documented, including regional hosting
- Prompts, retrieved content and outputs protected to the same standard as source documents
- Supplier security and privacy assessment completed before selection

### A13.4 Client separation and permissions

The system must prevent one client, project or user from seeing another client's data. Access controls are enforced at storage, database, search index, retrieval and interface level — never only as hidden menu options. (This is the primary architectural argument for keeping vectors inside Postgres — Part B §B3.)

### A13.5 Security evidence pack for clients

Architecture and data flow diagram; DPA and subprocessor list; security policy and incident response summary; encryption and key management description; access control and audit logging description; retention and deletion process; penetration test summary or independent assurance; a clear statement that client data is not used to train public models.

## A14. Administration and permissions

Create, suspend and remove users; assign roles by organisation, client, project and function; restrict raw transcript access; approve or reject uploads; edit metadata and taxonomies; manage retention and deletion; view audit logs; configure export permissions; set model and prompt templates; review usage and cost; maintain client-specific report templates.

## A15. Quality assurance and safeguards

Automated file and metadata validation at upload; spot checks comparing extracted text with originals; test sets of known questions and expected sources (the golden-question set); quote accuracy tests (automated string-match verification); permission boundary tests (automated, in CI); hallucination and unsupported-claim tests; bias and segment representation checks; performance tests across the full archive; UAT with experienced researchers; ongoing monitoring of retrieval quality and failed searches.

## A16. Future opportunities (beyond the post-v1 roadmap)

Subscription-based client Consumer Intelligence Platform; bespoke sector or brand archives; integration with survey data, social listening and economic indicators; automated presentation creation from approved templates; multilingual transcript analysis; secure client collaboration and commenting; forecasting and scenario signals (clearly labelled experimental); benchmarking new research against the archive; research planning recommendations from evidence gaps.

**Final development principle:** build the platform around three equal priorities — useful insight for the researcher, traceable evidence for the client, and rigorous security for every item of data.

---

# PART B — TECHNICAL BUILD SPECIFICATION

**Intended consumer: Claude Code.** Build the complete v1 in one continuous run, following the dependency-ordered build sequence in §B10 and writing the verification suites alongside each stage. The build is not complete until every check in §B10.6 and every acceptance criterion in §B12 passes. Decisions in this part are made — do not re-litigate them mid-build.

## B1. What gets built

A single-tenant (v1) Next.js application on Vercel implementing Part A. Users upload research documents; a durable background pipeline parses, chunks, and (after human review) embeds them into Postgres; hybrid retrieval feeds an LLM that produces cited, verifiable, cautiously-worded answers; outputs export to Word.

## B2. Non-goals for v1

Deferred, not rejected: multi-tenant client portals and client logins; the ten differentiated outputs in §A10 except Quote Finder, the basic Segment Observatory and the What-Has-Changed comparison, all three of which ARE in v1; native .pptx generation (v1 exports slide-ready text); trained sentiment/emotion classifiers (v1 uses LLM-assessed tone with visible caveats); NER-model PII redaction (v1 uses LLM-suggested, human-confirmed redaction at the review gate); multilingual transcripts; survey/social integration; forecasting; any model training or fine-tuning; full multi-dimensional data-quality scoring pipelines (v1 captures parse warnings and suggestion confidence only); a dedicated contradiction-detection tool; research memory across analyses; the Research Notebook; two-stage review workflows; analytics dashboards (v1 logs everything the dashboards will later need — usage, retrieval quality, cost — so they become queries, not schema changes).

## B3. Technology stack (decided)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15+ (App Router), TypeScript, RSC** | First-class on Vercel; server components keep retrieval logic and keys off the client |
| UI | **Tailwind CSS + shadcn/ui** | Fast, consistent, accessible |
| Database | **Neon Postgres + pgvector** | One store for relational data, full-text search and vectors: ACL, metadata filters and similarity search enforced in a single SQL query — one enforcement point for §A13.4. Deletion of a chunk removes text, index and embedding in one operation — satisfies §A13.1 permanent deletion. Serverless-friendly |
| ORM | **Drizzle ORM** + drizzle-kit migrations | Type-safe, SQL-transparent (hybrid search needs raw SQL), light in serverless |
| File storage | **Vercel Blob** | Originals at rest; client-side direct uploads bypass Vercel's 4.5 MB serverless body limit |
| Background jobs | **Inngest** | Ingestion exceeds serverless timeouts; Inngest gives durable, retryable, idempotent steps with no separate worker infra |
| Auth | **Auth.js (NextAuth v5)** + **Microsoft Entra ID** | SSO + MFA enforced at the IdP (§A13.1); credentials provider for local dev only; JWT sessions with role claims |
| LLM access | **Vercel AI SDK** | Provider abstraction implements §A12 model flexibility: swapping providers/models is configuration, not code |
| LLM routing (cost-optimised) | **Haiku 4.5 via the Batch API** for ingestion metadata suggestion (asynchronous anyway; batch is 50% off). **Sonnet-class** (`claude-sonnet-4-6`, or Sonnet 5 which launched June 2026 at introductory pricing) for user-facing queries and report drafts. **Prompt caching** on the static system prompt (~90% off cached input) | Ingestion is high-volume/low-difficulty; queries are low-volume/high-value. Model IDs live in one config file |
| LLM gateway option | The AI SDK can point at any OpenAI-compatible endpoint. If an existing corporate LiteLLM gateway with Claude behind it is available, prefer it: zero marginal cost to the project and data stays on already-assessed infrastructure. `LLM_BASE_URL` env var switches between direct Anthropic and gateway | |
| Embeddings | **Voyage AI `voyage-3.5-lite`** (cost-optimised default; `voyage-3-large` if retrieval quality tests demand it). Alternative: OpenAI `text-embedding-3-small`. Abstracted behind `lib/embeddings/` | Embedding the whole archive is a one-off cost in single-digit pounds either way |
| Reranking | **Optional in v1.** RRF fusion alone first; add Voyage `rerank-2` only if the golden-question set shows retrieval misses | Cheapest correct thing first, measured upgrade second |
| Parsing | `mammoth` (docx), `unzipper` + fast-xml-parser (pptx text), `xlsx`/SheetJS (Excel/CSV), `pdf-parse` (PDF), custom transcript parser (txt/vtt/docx transcripts) | All pure JS, serverless-compatible. No headless browsers, no LibreOffice, no Python sidecars |
| Word export | `docx` npm package, generated server-side, delivered via Blob | |
| Charts | Recharts; `d3-cloud` for word clouds; client-side canvas snapshot for image export | |
| Validation | Zod everywhere: API inputs, LLM structured outputs, env vars (fail fast at boot) | |
| Testing | Vitest (unit), Playwright (e2e incl. permission-boundary tests in CI) | |

**Why not a dedicated vector DB (e.g. Qdrant):** justified at much larger scale or multi-region. Here, vectors-in-Postgres means the client-separation requirement is enforced in one place, in one query, against one datastore — and permanent deletion is a plain `DELETE`. The retrieval layer sits behind a single interface (`lib/retrieval/`) so a dedicated vector store can be swapped in later without touching callers.

**Environment variables** (Zod-validated at boot): `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ANTHROPIC_API_KEY` (or `LLM_BASE_URL` + `LLM_API_KEY` for gateway mode), `VOYAGE_API_KEY`, `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.

**Running-cost picture:** Vercel Pro (~$20/month — the Hobby tier prohibits commercial/internal-business use, so this is likely the largest fixed line item); Neon, Inngest and Blob free tiers cover internal-use volumes; LLM spend at Haiku-batch ingestion + cached Sonnet queries is pennies-to-pounds per month at internal scale, or effectively zero in gateway mode.

## B4. Architecture

```
Browser ──(direct client upload)──► Vercel Blob
   │                                     │
   ▼                                     ▼ (event: document/uploaded)
Next.js App Router ──────────────► Inngest ingestion pipeline
   │  (RSC + route handlers)            parse → chunk → suggest metadata
   │                                     → [HUMAN REVIEW GATE] → embed → index
   ▼
Neon Postgres (pgvector + tsvector + relational + audit log)
   ▲
   │ hybrid retrieval: SQL( ACL ∧ metadata filters ∧ (vector ∪ FTS) ) → RRF → [rerank]
   │
Vercel AI SDK ──► Anthropic API / LiteLLM gateway (grounded, streamed, cited)
```

Two hard Vercel constraints shape everything and must not be violated:

1. **Uploads never pass through a serverless function body.** Use `@vercel/blob/client` `upload()` with a token-issuing route handler; the browser uploads directly to Blob. Completion creates the `documents` row and fires the Inngest event.
2. **No single function invocation performs whole-document ingestion.** Every Inngest `step.run()` is a bounded, idempotent, retryable unit (parse one file; embed one batch of ≤128 chunks).

## B5. Data model

Drizzle schema in `db/schema.ts`. First migration: `CREATE EXTENSION IF NOT EXISTS vector;`

```
users            id, email, name, entra_oid, role ENUM('admin','researcher','viewer'),
                 transcript_access BOOL DEFAULT false, active BOOL, created_at

clients          id, name, notes
projects         id, client_id FK, name, lawful_basis TEXT, retention_months INT
waves            id, project_id FK, wave_number INT, month INT, year INT,
                 fieldwork_notes TEXT, key_events TEXT[],
                 status ENUM('draft','confirmed')
                 UNIQUE(project_id, year, month)

segments         id, name, description          -- Fresco segments, seeded reference table
themes           id, name, definition, parent_id FK NULL,
                 status ENUM('active','merged'), merged_into FK NULL   -- merges traceable, never destructive

documents        id, wave_id FK, blob_url, blob_pathname, filename, mime_type,
                 sha256 (UNIQUE per wave — dedupe, §A4.2), version INT, supersedes FK NULL,
                 source_type ENUM('report','transcript','crib_sheet','moderator_notes',
                                  'discussion_guide','debrief_deck','coding_frame','tabular','other'),
                 status ENUM('uploaded','parsing','review','approved','indexed','failed','deleted'),
                 error TEXT NULL, parse_warnings JSONB NULL,   -- extraction issues surfaced in the review queue
                 uploaded_by FK, created_at
                 -- re-upload creates a new row (version+1, supersedes set); nothing silently overwritten

interviews       id, wave_id FK, external_ref TEXT ('RM_F_07_2026'),
                 segment_id FK NULL, age INT NULL, gender TEXT NULL, region TEXT NULL
                 -- pseudonymised: NO consumer names stored (§A13.2)

chunks           id, document_id FK, interview_id FK NULL, seq INT,
                 content TEXT, token_count INT,
                 speaker_role ENUM('moderator','consumer','mixed','n/a'),
                 evidence_type ENUM('direct_quote','researcher_summary','guide','context'),
                 section_path TEXT ('Report > Cost of living > Outlook'),
                 page_ref TEXT NULL,
                 segment_id FK NULL, wave_id FK (denormalised for filter speed),
                 embedding vector(1024) NULL,
                 tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
                 -- indexes: HNSW (embedding, vector_cosine_ops), GIN (tsv),
                 --          btree (wave_id, segment_id, evidence_type)

chunk_themes     chunk_id FK, theme_id FK, source ENUM('ai_suggested','human'),
                 confidence REAL NULL,          -- suggestion-pass confidence; human tags = NULL (authoritative)
                 PRIMARY KEY (chunk_id, theme_id)

conversations    id, user_id FK, title, created_at
messages         id, conversation_id FK, role, content, filters JSONB,
                 model TEXT, citations JSONB,
                 prompt_version TEXT, embedding_model TEXT, retrieval_version TEXT,
                 usage JSONB NULL,              -- { input_tokens, output_tokens, cached_tokens, est_cost }
                 created_at
                 -- full provenance (§A12): six months on, you can explain why an answer
                 -- changed after a prompt, retrieval or embedding upgrade

prompt_templates id, user_id FK, name, body TEXT, default_filters JSONB,
                 shared BOOL DEFAULT false, created_at
                 -- researcher-saved reusable prompts: monthly tracker, banking trust
                 -- review, energy deep dive, executive summary...

retrieval_log    id, message_id FK NULL, user_id FK, query_hash TEXT, filters JSONB,
                 candidate_count INT, top_rrf_score REAL, top_rerank_score REAL NULL,
                 weak_evidence BOOL, created_at
                 -- feeds future analytics (failed/weak searches, popular themes)
                 -- and the explainability panel; no raw chunk content stored

saved_outputs    id, user_id FK, kind ENUM('answer','quote_list','comparison','report_draft'),
                 title, content JSONB, created_at

audit_log        id, user_id FK NULL, action TEXT, entity_type TEXT, entity_id TEXT,
                 detail JSONB, ip TEXT, created_at
                 -- insert-only; written via one helper audit(); no update/delete code path exists
                 -- logged actions: login, upload, approve, reject, search, source_view,
                 --                 export, permission_change, delete, theme_edit
```

**Deletion contract (acceptance-critical):** deleting a document sets `status='deleted'`, deletes the Blob object, and hard-deletes its `chunks` (removing text, tsv and embeddings in one operation). The audit row records it. A nightly Inngest cron enforces `retention_months` per project. Verified by an automated test.

## B6. Ingestion pipeline (Inngest)

Event `document/uploaded { documentId }` → function `ingestDocument`:

1. **parse** — fetch from Blob; route by mime/source_type to `lib/parsers/`. Each parser returns `ParsedBlock[]: { text, sectionPath?, pageRef?, speaker?, style? }`. The docx parser preserves heading hierarchy (mammoth style map). The transcript parser detects speaker labels via configurable regexes (e.g. `^(MOD|MODERATOR|INT|I):` vs `R:`/`RESP`/named patterns) and tags every block `moderator` or `consumer`. Status → `review` on success, `failed` + error on failure.
2. **chunk** — merge blocks into **300–800 token** chunks. Reports split at heading boundaries. Transcripts split at **Q&A turn boundaries, never mid-answer**, keeping the moderator question attached to the consumer answer for context (`speaker_role='mixed'`, `evidence_type` follows the consumer content). Never fixed-window mid-sentence splitting. `evidence_type`: transcript consumer turns → `direct_quote`; report body → `researcher_summary`; guides → `guide`.
3. **suggest metadata** — Haiku via the Batch API, Zod-validated JSON per document: suggested themes per chunk (controlled taxonomy; genuinely-new theme proposals flagged separately), segment/interview mapping for transcripts, and **flagged possible PII spans** (names, phone numbers, addresses) for the reviewer. Suggestions stored, **not live**.
4. **[gate]** — pipeline pauses; document sits in `review`.
5. On human approval (route fires `document/approved`): **embed** — batches of ≤128 chunks per step → write vectors → status `indexed`.

Every LLM call in the pipeline records token usage; per-document ingestion cost is stored in `parse_warnings`'s sibling field on the job record and rolled up per wave. Parsers emit structured warnings (unreadable region, ambiguous speaker labels, suspected scanned/OCR-needed pages) into `documents.parse_warnings`; the review queue sorts warning-carrying documents first so reviewer attention goes where extraction is least trustworthy.

**Review UI (mandatory, part of the core build — not optional polish):** side-by-side original vs chunks; editable theme tags, segment, interview ref, speaker roles; accept/redact PII suggestions (redaction rewrites chunk content; the Blob original is untouched but access-restricted); approve or reject. This implements §A4.2's correct-before-live requirement and §A13.2's redaction requirement.

Monthly wave workflow = create wave → upload N files → review each → approve → wave `confirmed`.

## B7. Retrieval and generation

All retrieval goes through one function — `lib/retrieval/search.ts` — used by every feature:

```ts
searchChunks({
  query: string,
  filters: { waveIds?, dateRange?, segmentIds?, themeIds?, sourceTypes?,
             evidenceTypes?, speakerRole?, projectIds? },
  user: SessionUser,      // ACL applied INSIDE the SQL, never post-hoc
  k?: number              // default 24 candidates → (rerank) → top 8–12
})
```

- **Vector leg:** cosine `embedding <=> $queryEmbedding`, WHERE clause carries all metadata filters **and** the ACL (`transcript_access` gate on raw transcript chunks; project scoping when multi-client arrives).
- **Keyword leg:** `tsv @@ websearch_to_tsquery($query)` with `ts_rank`, identical WHERE clause.
- **Fusion:** reciprocal rank fusion (k=60) in application code. **Rerank:** optional (§B3).

**Generation rules** (system prompts live in `lib/prompts/*.ts`, versioned in git, changed by PR only):

- Context blocks numbered `[1]…[n]` with metadata headers (source type, wave, segment, evidence type). Every claim must cite `[n]`; the UI renders citations as links opening the source passage in the document viewer with the chunk highlighted.
- **Quote integrity is mechanical, not trusted:** consumer quotes may only come from `direct_quote` chunks and must be reproduced verbatim; a post-generation validator string-matches every quoted span against its cited chunk and the UI flags any mismatch ("quote could not be verified against source"). Never paraphrase inside quotation marks. "Lightly edited for readability" quotes are a distinct, labelled mode.
- **Qualitative safeguards (§A8.1) baked into the system prompt:** many/several/a few/appears/there is a sense; counts never presented as prevalence; explicit small-base note when evidence is < 3 supporting chunks or a single interview; contradictory views surfaced, never averaged away.
- **Insufficient evidence:** below a relevance threshold, the model must say so and show what *was* found rather than stretch. Responses must distinguish "not discussed" from "discussed and unimportant" (§A8).
- **Confidence is narrative and evidence-derived, never a percentage.** Alongside each substantive answer the system states its evidential basis, computed from the retrieved set (not asked of the model): number of distinct interviews, number of distinct waves, source-type diversity (transcripts vs reports vs notes), and spread across segments. Rendered as e.g. "High confidence: supported by 24 interviews across 11 waves, in both transcripts and final reports" or "Treat with caution: based on 2 interviews in a single wave." Numeric confidence scores are prohibited — they would violate §A8.1 by implying statistical precision qualitative data doesn't have.
- **Retrieval explainability:** because fusion happens in application code, per-result provenance is available for free — each retrieved chunk carries whether it matched the semantic leg, keyword leg or both, its scores, and the filters applied. The UI exposes this as a collapsible "why these results" panel on every answer and quote search. Researchers trust systems whose retrieval they can inspect.
- Streamed via AI SDK `streamText`; structured `citations` payload persisted to `messages` along with the model used.

**Comparison mode:** run `searchChunks` once per period/segment with identical query and differing filters; one generation pass over both labelled evidence sets with a compare-contrast prompt using the new / growing / continuing / fading framing (§A7.1, §A10.7).

## B8. Application surface (v1)

| Route | Feature |
|---|---|
| `/ask` | Ask the Archive — chat, filter sidebar (date, wave, segment, theme, source type, evidence type), streamed cited answers with evidential-basis statement, "why these results" panel, saved prompt templates, save to library |
| `/quotes` | Quote Finder — `evidence_type='direct_quote'` + consumer speaker filter, ranked results with speaker/interview/wave labels, exclude-moderator toggle, near-duplicate collapse (trigram similarity), shortlist basket, export |
| `/compare` | Compare Time Periods — two periods or two segments, structured comparison |
| `/segments` | Segment Observatory (basic) — per-segment: filtered ask, theme frequencies with small-n caveats, recent verbatim |
| `/reports` | Create Report — templates (monthly summary, theme deep-dive, what-changed) plus researcher-saved prompt templates, orchestrating multiple retrievals into an editable draft; .docx export with citations appendix |
| `/library` | Waves, documents, upload, review queue, source document viewer |
| `/admin` | Users/roles, theme taxonomy (add/define/merge), audit log viewer, retention settings, usage & cost summary (tokens and estimated spend by day/model/feature from `messages.usage` and ingestion job records; weak-evidence search count from `retrieval_log`) |

Route handlers under `/api/` are thin: Zod-validate → service call → `audit()` → respond. Inngest at `/api/inngest`; Blob token issuance at `/api/upload`.

## B9. Security implementation requirements (testable)

1. All routes behind Auth.js middleware; role checks server-side in every service function — never UI-only (§A13.4).
2. Raw transcript chunks retrievable only with `transcript_access`, enforced in retrieval SQL and the document viewer.
3. Every material action → `audit_log`; insert-only by construction.
4. Blob objects private; served only via short-lived signed URLs from an authorised route handler.
5. LLM/embedding providers used on enterprise/API terms (no training on inputs, §A13.3); no chunk content in production logs.
6. TLS and at-rest encryption via platform defaults; secrets only in Vercel env vars.
7. Deletion contract (§B5) proven by automated test.
8. Dev/preview environments use the synthetic seed corpus only — never live client data (§A13.1).
9. Dependency scanning in CI; Playwright permission-boundary tests (viewer cannot reach admin routes; non-transcript user cannot retrieve transcript evidence) run on every PR.

## B10. Build sequence — one continuous run

v1 is built as a single continuous effort. The stages below are a **dependency order**, not gates: each stage depends on the previous one existing, so build them in this order, but do not stop between them. Tests are written **with** each stage, run continuously, and the whole suite must be green at the end — this is what allows the run to be unattended without the result being unverifiable.

### B10.1 Foundation
Scaffold Next.js + Tailwind + shadcn/ui; full Drizzle schema + migrations (§B5); Auth.js with Entra ID + dev-credentials provider; role middleware; `audit()` helper; Zod env validation; seed script generating a **synthetic corpus** (3 waves × 6 fake transcripts + 1 fake report each, covering all Fresco segments and ~8 themes). The synthetic corpus is written once here and used by every subsequent test — invest in making it realistic (proper moderator/consumer turn structure, headed report sections, planted facts and quotes that the golden questions will later target).

### B10.2 Ingestion
Blob client-upload flow; all parsers (§B6); Inngest pipeline through the review gate; review UI including PII redaction; embedding on approval; document viewer; versioning + hash dedupe; deletion contract. *Tests written here:* end-to-end ingestion of the synthetic corpus; chunk assertions (speaker roles, evidence types, section paths); the deletion test proving chunks + vectors + blob are removed.

### B10.3 Retrieval and Ask the Archive
`searchChunks` hybrid retrieval (§B7); cited streaming chat with filter sidebar; evidential-basis (confidence) statements; "why these results" explainability panel; `retrieval_log` writes; provenance fields (prompt/retrieval/embedding versions) and token usage persisted on every message; quote-verification validator; Quote Finder with shortlist and clipboard export; prompt templates (save/load). *Tests written here:* the **golden-question suite** — 10+ questions from §A7.2 against the synthetic corpus with known expected sources, asserting every answer cites, every citation resolves to the right passage, and every quote string-matches its chunk; plus the permission-boundary tests (non-transcript user retrieves zero transcript evidence).

### B10.4 Comparison, segments, reports, export
Comparison mode; segment pages; report templates with editable drafts; `docx` export with citations appendix; theme admin (add/define/merge); word cloud and theme-frequency timeline visuals. *Tests written here:* the full monthly-wave journey (§A7.1) as a Playwright e2e — upload wave → review → confirm → what-changed vs previous wave → edit draft → export .docx.

### B10.5 Hardening pass
Sweep §B9 items 1–9 as a checklist against the finished code; audit-log coverage check (every action in §B5's list actually writes a row); provenance coverage check (no message row with NULL prompt_version/usage); admin usage & cost summary; production log scrubbing; error states and empty states across all routes.

### B10.6 Definition of done for the whole run
The build is complete only when, from a clean database: migrations apply; seed runs; the synthetic corpus ingests end-to-end through the UI; the golden-question suite passes; the permission-boundary suite passes; the deletion test passes; the monthly-wave e2e passes; `pnpm build` succeeds with no type errors; and every §B12 acceptance criterion is demonstrably met. If any of these fail, the run is not finished — fix and re-run the suite rather than reporting partial success.

### B10.7 Post-v1 (separate spec when reached)
Client workspaces + row-level project ACLs; the §A10 differentiated outputs; dashboards; native .pptx export; retention automation UI; pen portraits; penetration test + client security evidence pack (§A13.5).

## B11. Working notes for Claude Code

- Keep `CLAUDE.md` at repo root: the stack table above (marked *do not swap*), how to run migrations/seed/tests, synthetic-corpus location, and the rule that **every feature PR ships with its Playwright test**.
- Build in the §B10 dependency order without stopping between stages, but treat §B10.6 as a hard definition of done — never report the build complete with failing checks.
- Prompts are code: `lib/prompts/*.ts`, exported constants, changed via PR only.
- All LLM structured outputs parsed with Zod + one retry-with-error-feedback; never trust raw JSON.
- Model IDs and provider base URL live in one config module — swapping Sonnet↔Haiku or direct↔gateway is a one-line change.
- Prefer boring solutions. Anything clever in retrieval must beat the boring version on the golden-question set before it is kept.

## B12. Acceptance criteria (v1, must all pass before the build is declared complete)

1. A researcher uploads a monthly wave without developer support and confirms it via the review UI.
2. Every indexed chunk carries wave, source type, evidence type, speaker role and, where applicable, segment, interview, theme and section metadata.
3. The §A7.2 example questions return relevant, cited answers.
4. Direct quotes are reproduced exactly and every quote is machine-verified against its source chunk.
5. Arbitrary period and segment comparisons work with the new/growing/continuing/fading framing.
6. Outputs export to editable Word with source references retained; tables export to CSV; slide-ready copy is available.
7. A user without transcript access can never retrieve raw transcript content by any route (automated permission tests).
8. Deleting a document removes source file, chunks, full-text entries and embeddings (automated test).
9. Audit log records logins, uploads, approvals, searches, source views, exports, permission changes and deletions.
10. Small-sample caveats and cautious qualitative language appear in generated outputs; thin evidence is flagged, never papered over.
11. All production data is encrypted and behind enterprise SSO/MFA.
12. Every generated answer records full provenance (model, prompt version, retrieval version, embedding model) and token usage, and states its evidential basis in narrative form — never as a numeric confidence score.
13. Every answer and quote search offers an inspectable "why these results" breakdown (match type, scores, filters applied).
14. UAT with experienced researchers confirms meaningful analysis-time savings with research nuance preserved.
