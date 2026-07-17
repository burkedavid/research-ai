import { generateObject } from "ai";
import { z } from "zod";
import { getLlm } from "@/lib/llm";
import { env } from "@/lib/env";
import type { ChunkDraft } from "./chunk";

export interface PiiSpan {
  text: string;
  kind: "name" | "phone" | "email" | "address" | "other";
}

export interface ThemeSuggestion {
  name: string;
  confidence: number;
}

export interface ChunkSuggestions {
  seq: number;
  themes: ThemeSuggestion[];
  pii: PiiSpan[];
}

export interface SuggestUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

const suggestionSchema = z.object({
  chunks: z.array(
    z.object({
      seq: z.number(),
      themes: z.array(z.object({ name: z.string(), confidence: z.number().min(0).max(1) })),
      newThemeProposals: z.array(z.string()).default([]),
      pii: z.array(
        z.object({
          text: z.string(),
          kind: z.enum(["name", "phone", "email", "address", "other"]),
        }),
      ),
    }),
  ),
});

/** Deterministic PII regexes — always applied, in both fake and LLM modes. */
export function regexPii(text: string): PiiSpan[] {
  const spans: PiiSpan[] = [];
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) {
    spans.push({ text: m[0], kind: "email" });
  }
  for (const m of text.matchAll(/(?:\+44\s?|0)(?:\d\s?){9,10}\b/g)) {
    spans.push({ text: m[0].trim(), kind: "phone" });
  }
  for (const m of text.matchAll(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g)) {
    spans.push({ text: m[0], kind: "address" });
  }
  for (const m of text.matchAll(/\bmy name is ([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g)) {
    spans.push({ text: m[1], kind: "name" });
  }
  return spans;
}

/** Keyword heuristics per theme — the fake-mode suggester and a sanity floor. */
const THEME_KEYWORDS: Record<string, string[]> = {
  "Cost of living and inflation": ["cost of living", "inflation", "prices", "expensive", "price rise"],
  "Energy and fuel": ["energy", "heating", "electric", "gas", "fuel", "tariff", "meter", "kilowatt", "boiler", "oil"],
  "Food shopping": ["food", "supermarket", "shop", "groceries", "basket", "meal"],
  "Savings, debt and budgeting": ["saving", "savings", "debt", "budget", "overdraft", "borrow", "deposit"],
  "Banks and financial services": ["bank", "banking", "branch", "mortgage", "account", "rates"],
  "Pensions and retirement": ["pension", "retire", "retirement"],
  "Digital banking and technology": ["app", "online", "digital", "smart meter", "phone"],
  "AI and automation": ["ai ", " ai", "artificial intelligence", "automat", "chatbot"],
  "Trust, fairness and confidence": ["trust", "fair", "unfair", "confidence", "profiteer"],
  "Optimism, anxiety and resilience": ["optimis", "anxious", "anxiety", "worried", "worry", "hope", "resilien", "mood", "pessimis"],
  "NHS and public services": ["nhs", "hospital", "doctor", "public services"],
  "Politics, elections and government policy": ["government", "election", "policy", "politic", "budget announcement"],
  "Work and employment": ["job", "work", "employ", "wages", "salary", "pay rise", "furlough"],
  Housing: ["house", "housing", "rent", "landlord", "mortgage", "flat"],
  "Holidays and discretionary spending": ["holiday", "cruise", "trip", "eating out", "gym", "subscription"],
  "Christmas and seasonal pressures": ["christmas", "seasonal", "presents", "winter"],
};

export function heuristicThemes(content: string, themeNames: string[]): ThemeSuggestion[] {
  const lower = ` ${content.toLowerCase()} `;
  const suggestions: ThemeSuggestion[] = [];
  for (const name of themeNames) {
    const keywords = THEME_KEYWORDS[name];
    if (!keywords) continue;
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits > 0) {
      suggestions.push({ name, confidence: Math.min(0.9, 0.4 + hits * 0.15) });
    }
  }
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}

/**
 * Metadata suggestion (§B6.3): themes per chunk from the controlled taxonomy
 * plus flagged possible PII spans. LLM output is Zod-validated with one
 * retry-with-error-feedback (§B11); suggestions are stored, never live.
 *
 * Cost note (§B3): production uses Haiku. The Anthropic Batch API (50% off)
 * is a drop-in optimisation for this call site once volumes justify it —
 * the call is already asynchronous inside a durable Inngest step.
 */
export async function suggestMetadata(
  chunks: ChunkDraft[],
  themeNames: string[],
): Promise<{ suggestions: ChunkSuggestions[]; usage: SuggestUsage }> {
  if (env.LLM_PROVIDER === "fake") {
    return {
      suggestions: chunks.map((c) => ({
        seq: c.seq,
        themes: heuristicThemes(c.content, themeNames),
        pii: regexPii(c.content),
      })),
      usage: { inputTokens: 0, outputTokens: 0, model: "heuristic" },
    };
  }

  const { model, modelId } = getLlm("ingestion");
  const prompt = [
    "You label qualitative research chunks for a research archive.",
    `Controlled theme taxonomy: ${themeNames.join("; ")}.`,
    "For each chunk: suggest up to 4 themes FROM THE TAXONOMY with confidence 0-1;",
    "propose genuinely new themes separately in newThemeProposals (rarely);",
    "flag possible PII spans (person names, phone numbers, email addresses, street addresses).",
    "Do not flag pseudonymised interview references like RM_F_07_2026.",
    "",
    ...chunks.map((c) => `--- chunk seq=${c.seq} ---\n${c.content}`),
  ].join("\n");

  let attempt = 0;
  let lastError = "";
  while (attempt < 2) {
    try {
      const result = await generateObject({
        model,
        schema: suggestionSchema,
        prompt: attempt === 0 ? prompt : `${prompt}\n\nYour previous output failed validation: ${lastError}. Return valid JSON matching the schema.`,
      });
      const bySeq = new Map(result.object.chunks.map((c) => [c.seq, c]));
      return {
        suggestions: chunks.map((c) => {
          const s = bySeq.get(c.seq);
          const pii = [...(s?.pii ?? []), ...regexPii(c.content)];
          const seen = new Set<string>();
          return {
            seq: c.seq,
            themes: (s?.themes ?? []).filter((t) => themeNames.includes(t.name)),
            pii: pii.filter((p) => (seen.has(p.text) ? false : (seen.add(p.text), true))),
          };
        }),
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          model: modelId,
        },
      };
    } catch (err) {
      lastError = String(err);
      attempt++;
    }
  }
  throw new Error(`Metadata suggestion failed after retry: ${lastError}`);
}
