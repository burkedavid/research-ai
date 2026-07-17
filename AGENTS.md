<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Consumer Sentiment Intelligence Hub

Secure RAG platform over a longitudinal qualitative research archive. Full spec: `consumer-sentiment-hub-full-spec.md` (Part A = intent, Part B = implementation; B wins for build decisions).

## Stack (decided in §B3 — do not swap)

Next.js App Router + TypeScript · Tailwind · Neon Postgres + pgvector (Docker locally) · Drizzle ORM · Vercel Blob (local-disk driver in dev) · Inngest (inline mode in dev/tests) · Auth.js v5 + Entra ID (dev credentials login locally) · Vercel AI SDK (Anthropic / gateway / deterministic fake) · Voyage embeddings (deterministic fake in dev/tests) · Zod everywhere · Vitest + Playwright.

## Running locally

```bash
docker compose up -d          # postgres :5432 (dev) + :5433 (test, tmpfs)
npm run db:migrate            # apply migrations (db/migrations)
npm run db:seed               # users, segments, themes, project + seed-corpus/ files
npm run dev                   # app on :3000
```

Dev login (any seeded user): password `dev-password`.
Users: `admin@example.com` (admin), `researcher@example.com` (researcher + transcripts), `summary-only@example.com` (researcher, NO transcripts), `viewer@example.com` (viewer).

`.env.local` defaults to fake LLM/embeddings and the inline pipeline — no API keys or Inngest server needed. Real providers: set `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`, `EMBEDDINGS_PROVIDER=voyage` + `VOYAGE_API_KEY`, `PIPELINE_MODE=inngest` + `npm run inngest:dev`.

## Tests

```bash
npm test                      # vitest: parsers, ingestion, golden questions, permissions, features
npm run test:e2e              # playwright: monthly-wave journey + browser permission boundaries
```

Both suites run against the :5433 test database (reset per run) with fake providers — fully deterministic, no keys. The golden-question suite (`tests/golden-questions.test.ts`) targets planted facts in the synthetic corpus (`lib/seed/corpus.ts`); if you change corpus text, keep the planted quotes or update the tests with them.

## Architecture map

- `db/schema.ts` — full §B5 schema. Migrations via `npm run db:generate` (never hand-edit applied migrations).
- `lib/parsers/` — docx/pptx/xlsx/pdf/transcript → `ParsedBlock[]` + warnings.
- `lib/ingestion/` — chunk (Q&A-boundary + heading-boundary), suggest (themes + PII), pipeline stages (pure functions), dispatch (inline vs Inngest).
- `lib/retrieval/search.ts` — THE one retrieval function: hybrid vector+FTS, ACL and filters inside the SQL, RRF fusion in app code. Everything retrieves through this.
- `lib/retrieval/verify.ts` — mechanical quote verification; `confidence.ts` — narrative evidential basis (numeric confidence scores are prohibited by spec).
- `lib/prompts/*.ts` — prompts are code, versioned, changed by PR only.
- `lib/llm/` + `lib/embeddings/` — provider abstraction; model IDs in `lib/config.ts` only.
- `lib/services/` — all business logic; routes under `app/api/` are thin (Zod → service → audit → respond).
- `lib/audit.ts` — the ONLY write path to audit_log; never add update/delete for it.

## Rules

- Every feature ships with its test (Playwright for journeys, vitest for services) — §B11.
- Role checks live in services (server-side), never only in UI.
- Raw transcript evidence requires `users.transcript_access` — enforced in retrieval SQL and the file route; keep it that way.
- Deleting a document must remove blob + chunks + tsv + embeddings (see `deleteDocumentData`), proven by `tests/ingestion.test.ts`.
- LLM structured output: Zod-parse + one retry-with-error-feedback; never trust raw JSON.

## Deploying (Neon + Vercel)

Set env vars per `.env.example`: `DATABASE_URL` (Neon pooled), `STORAGE_DRIVER=vercel-blob` + `BLOB_READ_WRITE_TOKEN`, `PIPELINE_MODE=inngest` + Inngest keys, Entra ID trio + `AUTH_SECRET`, real LLM/embeddings keys. `lib/env.ts` fails the boot loudly if a dev-only setting (fake providers, dev login, inline pipeline) reaches production. Never set `E2E_ALLOW_DEV_CONFIG` in a deployment.
