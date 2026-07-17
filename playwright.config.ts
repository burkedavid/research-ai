import { defineConfig } from "@playwright/test";

const TEST_DB_URL = "postgres://postgres:postgres@localhost:5433/sentiment_hub_test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100/login",
    timeout: 900_000,
    reuseExistingServer: true,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: TEST_DB_URL,
      AUTH_SECRET: "e2e-test-secret-not-for-production",
      AUTH_TRUST_HOST: "true",
      // e2e exercises the dev-login path; the guard that forbids this in real
      // production is covered by unit assertions on lib/env instead
      DEV_LOGIN_ENABLED: "true",
      STORAGE_DRIVER: "local",
      LLM_PROVIDER: "fake",
      EMBEDDINGS_PROVIDER: "fake",
      PIPELINE_MODE: "inline",
      E2E_ALLOW_DEV_CONFIG: "true",
    },
  },
});
