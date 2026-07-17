import { execSync } from "node:child_process";
import path from "node:path";

const TEST_DB_URL = "postgres://postgres:postgres@localhost:5433/sentiment_hub_test";

/**
 * E2E setup runs in a tsx subprocess because Playwright's TS loader does not
 * resolve `@/*` tsconfig aliases in modules imported from globalSetup.
 */
export default function globalSetup() {
  execSync(`npx tsx ${path.join("e2e", "setup-db.ts")}`, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: TEST_DB_URL,
      AUTH_SECRET: "e2e-test-secret-not-for-production",
      STORAGE_DRIVER: "local",
      LLM_PROVIDER: "fake",
      EMBEDDINGS_PROVIDER: "fake",
      PIPELINE_MODE: "inline",
    },
  });
}
