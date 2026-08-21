import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { COST_PER_MTOK_USD, MODELS, OPENAI_MODELS } from "@/lib/config";
import { env } from "@/lib/env";

export type ModelJob = "query" | "ingestion";
const KEYS: Record<ModelJob, string> = { query: "model.query", ingestion: "model.ingestion" };

/**
 * Which models the admin has chosen, if any. Lets a team trial a cheaper or
 * stronger model on real work without a redeploy — the alternative is guessing
 * which model is "good enough", which nobody can answer in the abstract.
 *
 * Precedence: admin choice (DB) > env override > the code default.
 */
export async function getModelOverrides(): Promise<Partial<Record<ModelJob, string>>> {
  try {
    const rows = await db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, [KEYS.query, KEYS.ingestion]));
    const out: Partial<Record<ModelJob, string>> = {};
    for (const r of rows) {
      if (r.key === KEYS.query && r.value) out.query = r.value;
      if (r.key === KEYS.ingestion && r.value) out.ingestion = r.value;
    }
    return out;
  } catch {
    // settings table missing (pre-migration) must not break generation
    return {};
  }
}

/** The model that will actually be used for a job right now. */
export async function resolveModel(job: ModelJob): Promise<string | undefined> {
  const overrides = await getModelOverrides();
  return overrides[job];
}

export async function setModel(job: ModelJob, model: string | null, userId: string): Promise<void> {
  if (model) {
    await db
      .insert(appSettings)
      .values({ key: KEYS[job], value: model, updatedBy: userId })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: model, updatedBy: userId, updatedAt: new Date() },
      });
  } else {
    await db.delete(appSettings).where(eq(appSettings.key, KEYS[job]));
  }
}

/** Models offered in the picker for the active provider, with their prices so
 *  the cost/quality trade-off is visible at the point of choosing. */
export function selectableModels(): { id: string; inputUsd: number; outputUsd: number }[] {
  const ids =
    env.LLM_PROVIDER === "openai"
      ? ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-4.1", "gpt-4.1-mini"]
      : env.LLM_PROVIDER === "anthropic"
        ? [MODELS.query, MODELS.ingestion]
        : [];
  return ids
    .filter((id) => COST_PER_MTOK_USD[id])
    .map((id) => ({ id, inputUsd: COST_PER_MTOK_USD[id].input, outputUsd: COST_PER_MTOK_USD[id].output }));
}

/** The default a job falls back to when no override is set. */
export function defaultModel(job: ModelJob): string {
  if (env.LLM_PROVIDER === "openai") {
    return job === "query"
      ? (env.OPENAI_QUERY_MODEL ?? OPENAI_MODELS.query)
      : (env.OPENAI_INGESTION_MODEL ?? OPENAI_MODELS.ingestion);
  }
  return MODELS[job];
}
