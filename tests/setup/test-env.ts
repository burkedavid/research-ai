// Ensures test env vars are present before any app module loads lib/env.
// vitest's `env` config sets these too; this file is a belt-and-braces guard
// so a stray import order can never point tests at the dev database.
process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5433/sentiment_hub_test";
process.env.AUTH_SECRET ??= "test-secret";
process.env.STORAGE_DRIVER = "local";
process.env.LLM_PROVIDER = "fake";
process.env.EMBEDDINGS_PROVIDER = "fake";
process.env.PIPELINE_MODE = "inline";
