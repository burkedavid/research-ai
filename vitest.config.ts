import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    setupFiles: ["./tests/setup/test-env.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // integration tests share one database — no parallel files
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5433/sentiment_hub_test",
      AUTH_SECRET: "test-secret",
      DEV_LOGIN_ENABLED: "true",
      STORAGE_DRIVER: "local",
      LLM_PROVIDER: "fake",
      EMBEDDINGS_PROVIDER: "fake",
      PIPELINE_MODE: "inline",
    },
  },
});
