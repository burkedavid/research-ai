# Deployment guide

Consumer Sentiment Intelligence Hub — Sentiment Research. This guide covers running
it locally and deploying to production (Neon + Vercel).

## What it is

A single-tenant Next.js RAG platform over a longitudinal qualitative-research archive:
upload research documents → human review gate → hybrid retrieval (pgvector + full-text)
→ cited, verifiable, cautiously-worded answers → Word/CSV export. Full spec in
`consumer-sentiment-hub-full-spec.md`.

## Run it locally

```bash
docker compose up -d          # Postgres+pgvector on :5432 (dev) and :5433 (test)
cp .env.example .env.local    # defaults are dev-safe (fake LLM + embeddings, inline pipeline)
npm install
npm run db:migrate            # create the schema (first migration installs pgvector)
npm run db:seed               # reference data + writes the synthetic corpus to seed-corpus/
npm run dev                   # http://localhost:3000
```

**Dev sign-in** (password `dev-password` for all):

| Email | Role |
|---|---|
| `admin@example.com` | admin |
| `researcher@example.com` | researcher, transcript access |
| `summary-only@example.com` | researcher, NO transcript access |
| `viewer@example.com` | viewer (read-only) |

The dev DB starts with reference data only. To populate it with searchable content,
either upload files from `seed-corpus/` through **Library → New wave**, or run:

```bash
npx tsx scripts/ingest-corpus-dev.ts   # ingests + approves the 3 synthetic waves
```

### Fake vs real providers

Out of the box everything runs on **deterministic stand-ins** — no API keys, no cost,
fully reproducible (this is what the test suites use):

- `LLM_PROVIDER=fake` — a built-in model that composes grounded, cited answers from the
  retrieved evidence with the qualitative-safeguard rules applied.
- `EMBEDDINGS_PROVIDER=fake` — deterministic hash embeddings; real pgvector search, but
  similarity is word-overlap, not semantic.

To use real AI (no code changes — the providers are abstracted):

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
EMBEDDINGS_PROVIDER=voyage
VOYAGE_API_KEY=pa-...
```

or point at a corporate gateway with `LLM_PROVIDER=gateway`, `LLM_BASE_URL`, `LLM_API_KEY`.
After switching embeddings, re-approve documents so they are re-embedded with the real model.

## Tests

```bash
npm test          # vitest: parsers, ingestion, golden questions, permissions, features, hardening
npm run test:e2e  # Playwright: monthly-wave journey + browser permission boundaries
```

Both run against the :5433 test database on fake providers — deterministic, no keys.

## Deploy to production (Neon + Vercel)

### 1. Database (Neon)

The Neon project is already created. Apply the schema and reference data once, from your
machine, pointing at the **pooled** connection string:

```bash
DATABASE_URL='<neon-pooled-url>' npx drizzle-kit migrate
DATABASE_URL='<neon-pooled-url>' AUTH_SECRET=x npx tsx scripts/seed.ts
```

pgvector is created automatically by the first migration. After seeding, replace the
example users with your real team's emails via `/admin` or SQL — Entra sign-in only
admits emails that already exist and are active in the `users` table.

> Do **not** enable "Neon Auth" — the app has its own Auth.js + Entra ID system and its
> own users table; Neon Auth would be an unused parallel store.

### 2. Storage, jobs, auth, LLM

- **Vercel Blob** — create a store, set `STORAGE_DRIVER=vercel-blob` and `BLOB_READ_WRITE_TOKEN`.
- **Inngest** — connect the app, set `PIPELINE_MODE=inngest`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- **Microsoft Entra ID** — register an app, set `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER`
  and a strong `AUTH_SECRET` (`openssl rand -base64 32`). MFA is enforced at Entra.
- **LLM + embeddings** — real keys as above.

### 3. Vercel

Import the GitHub repo, set all the env vars from `.env.example` with production values,
deploy. `lib/env.ts` fails the boot loudly if any dev-only setting (fake providers, dev
login, inline pipeline) reaches production — that is intentional. Never set
`E2E_ALLOW_DEV_CONFIG` in a deployment.

Required production env vars: `DATABASE_URL`, `AUTH_SECRET`,
`AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`,
`STORAGE_DRIVER=vercel-blob`, `BLOB_READ_WRITE_TOKEN`, `PIPELINE_MODE=inngest`,
`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `LLM_PROVIDER`, `ANTHROPIC_API_KEY`
(or gateway trio), `EMBEDDINGS_PROVIDER=voyage`, `VOYAGE_API_KEY`.
