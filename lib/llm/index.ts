import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { MODELS } from "@/lib/config";
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
export function getLlm(kind: ModelKind): LlmHandle {
  const modelId = MODELS[kind];
  switch (env.LLM_PROVIDER) {
    case "anthropic": {
      const provider = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
      return { model: provider(modelId) as unknown as LanguageModelV3, modelId };
    }
    case "gateway": {
      const provider = createAnthropic({ baseURL: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY });
      return { model: provider(modelId) as unknown as LanguageModelV3, modelId };
    }
    case "fake":
      return { model: createFakeModel(), modelId: "fake-llm" };
  }
}
