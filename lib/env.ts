import { z } from "zod";

/**
 * Environment validation (§B3): fail fast at boot.
 * Import `env` everywhere instead of touching process.env.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
    AUTH_MICROSOFT_ENTRA_ID_ID: z.string().optional(),
    AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().optional(),
    AUTH_MICROSOFT_ENTRA_ID_ISSUER: z.string().optional(),
    DEV_LOGIN_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true"),

    STORAGE_DRIVER: z.enum(["local", "vercel-blob"]).default("local"),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),

    LLM_PROVIDER: z.enum(["anthropic", "openai", "gateway", "fake"]).default("fake"),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    // Optional overrides for the OpenAI chat model IDs (see OPENAI_MODELS).
    OPENAI_QUERY_MODEL: z.string().optional(),
    OPENAI_INGESTION_MODEL: z.string().optional(),
    LLM_BASE_URL: z.string().optional(),
    LLM_API_KEY: z.string().optional(),

    EMBEDDINGS_PROVIDER: z.enum(["voyage", "openai", "fake"]).default("fake"),
    VOYAGE_API_KEY: z.string().optional(),

    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),

    // inline: run pipeline stages synchronously (dev/tests, no Inngest server
    // needed). inngest: durable background pipeline (required in production).
    PIPELINE_MODE: z.enum(["inline", "inngest"]).default("inline"),
  })
  .superRefine((cfg, ctx) => {
    // Playwright runs a production build against the fake providers and dev
    // login. This flag relaxes ONLY the prod-config guards below; it is never
    // set in a real deployment (checked in the §B9 hardening checklist).
    // `next build` itself also imports modules with NODE_ENV=production while
    // local dev env values are loaded — guards enforce at runtime boot, not
    // during the build phase.
    const e2e = process.env.E2E_ALLOW_DEV_CONFIG === "true" || process.env.NEXT_PHASE === "phase-production-build";
    if (cfg.STORAGE_DRIVER === "vercel-blob" && !cfg.BLOB_READ_WRITE_TOKEN) {
      ctx.addIssue({
        code: "custom",
        message: "BLOB_READ_WRITE_TOKEN is required when STORAGE_DRIVER=vercel-blob",
      });
    }
    if (cfg.LLM_PROVIDER === "anthropic" && !cfg.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: "custom", message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic" });
    }
    // One key serves both the OpenAI chat and OpenAI embeddings providers.
    if ((cfg.LLM_PROVIDER === "openai" || cfg.EMBEDDINGS_PROVIDER === "openai") && !cfg.OPENAI_API_KEY) {
      ctx.addIssue({ code: "custom", message: "OPENAI_API_KEY is required when using the OpenAI provider" });
    }
    if (cfg.LLM_PROVIDER === "gateway" && (!cfg.LLM_BASE_URL || !cfg.LLM_API_KEY)) {
      ctx.addIssue({ code: "custom", message: "LLM_BASE_URL and LLM_API_KEY are required when LLM_PROVIDER=gateway" });
    }
    if (cfg.EMBEDDINGS_PROVIDER === "voyage" && !cfg.VOYAGE_API_KEY) {
      ctx.addIssue({ code: "custom", message: "VOYAGE_API_KEY is required when EMBEDDINGS_PROVIDER=voyage" });
    }
    if (cfg.NODE_ENV === "production" && !e2e && cfg.DEV_LOGIN_ENABLED) {
      ctx.addIssue({ code: "custom", message: "DEV_LOGIN_ENABLED must not be true in production" });
    }
    if (cfg.NODE_ENV === "production" && !e2e && cfg.LLM_PROVIDER === "fake") {
      ctx.addIssue({ code: "custom", message: "LLM_PROVIDER=fake is not allowed in production" });
    }
    if (cfg.NODE_ENV === "production" && !e2e && cfg.EMBEDDINGS_PROVIDER === "fake") {
      ctx.addIssue({ code: "custom", message: "EMBEDDINGS_PROVIDER=fake is not allowed in production" });
    }
    if (cfg.NODE_ENV === "production" && !e2e && cfg.PIPELINE_MODE === "inline") {
      ctx.addIssue({ code: "custom", message: "PIPELINE_MODE must be 'inngest' in production" });
    }
  });

/** Exposed for the hardening test suite; app code uses `env` below. */
export function parseEnv(raw: NodeJS.ProcessEnv): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(config)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = parseEnv(process.env);
export type Env = typeof env;
