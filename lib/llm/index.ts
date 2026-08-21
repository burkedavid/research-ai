import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { MODELS, OPENAI_MODELS } from "@/lib/config";
import { env } from "@/lib/env";
import { createFakeModel } from "./fake";

export type ModelKind = keyof typeof MODELS;

export interface LlmHandle {
  model: LanguageModelV3;
  /** Recorded on messages for provenance (§B5, §A12). */
  modelId: string;
}

/**
 * Provider abstraction (§A12 model flexibility, §B3): direct Anthropic, an
 * OpenAI/Anthropic-compatible gateway (LiteLLM passes /v1/messages through),
 * or the deterministic fake for dev/tests. Swapping is configuration only.
 */
export function getLlm(kind: ModelKind, override?: string): LlmHandle {
  const modelId = override ?? MODELS[kind];
  switch (env.LLM_PROVIDER) {
    case "anthropic": {
      const provider = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
      return { model: provider(modelId) as unknown as LanguageModelV3, modelId };
    }
    case "openai": {
      const provider = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      const openaiId =
        override ??
        (kind === "query"
          ? (env.OPENAI_QUERY_MODEL ?? OPENAI_MODELS.query)
          : (env.OPENAI_INGESTION_MODEL ?? OPENAI_MODELS.ingestion));
      return { model: provider(openaiId) as unknown as LanguageModelV3, modelId: openaiId };
    }
    case "gateway": {
      const provider = createAnthropic({ baseURL: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY });
      return { model: provider(modelId) as unknown as LanguageModelV3, modelId };
    }
    case "fake":
      return { model: createFakeModel(), modelId: "fake-llm" };
  }
}
