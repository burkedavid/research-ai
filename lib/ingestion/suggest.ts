import { generateObject } from "ai";
import { z } from "zod";
import { recordAiUsage } from "@/lib/ai-usage";
import { getLlm } from "@/lib/llm";
import { resolveModel } from "@/lib/services/model-settings";
import { env } from "@/lib/env";
import type { ChunkDraft } from "./chunk";

/** A theme as the tagger sees it. The definition is what disambiguates a label
 *  like "Housing", so it travels with the name rather than sitting unused in
 *  the database. */
export interface TaxonomyEntry {
  name: string;
  definition: string | null;
}

export interface PiiSpan {
  text: string;
  kind: "name" | "phone" | "email" | "address" | "other";
}

export interface ThemeSuggestion {
  name: string;
  confidence: number;
}

export type Sentiment = "positive" | "negative" | "neutral" | "mixed";

export interface ChunkSuggestions {
  seq: number;
  themes: ThemeSuggestion[];
  pii: PiiSpan[];
  sentiment: Sentiment;
}

export interface SuggestUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/** Topics that recur in consumer talk but sit OUTSIDE the seeded taxonomy —
 *  used by fake mode to surface realistic new-theme proposals (F1). The real
 *  LLM proposes these itself via the schema's newThemeProposals field. */
const OFF_TAXONOMY_PROPOSALS: { theme: string; keywords: string[] }[] = [
  { theme: "Subscriptions and streaming", keywords: ["streaming", "subscription", "netflix", "sim "] },
  { theme: "Mental health and wellbeing", keywords: ["mental health", "wellbeing", "stress", "lonely", "isolation"] },
  { theme: "Childcare and family costs", keywords: ["childcare", "school", "kids ", "children"] },
  { theme: "Insurance and protection", keywords: ["insurance", "cover", "premium"] },
];

function heuristicNewThemes(content: string): string[] {
  const lower = ` ${content.toLowerCase()} `;
  return OFF_TAXONOMY_PROPOSALS.filter((p) => p.keywords.some((k) => lower.includes(k))).map((p) => p.theme);
}

const POSITIVE_CUES = ["optimis", "hopeful", "confiden", "positive", "steadier", "relief", "comfortable", "better", "recover", "pleased", "good", "kind", "helpful", "grateful", "genuinely hopeful"];
const NEGATIVE_CUES = ["anxious", "anxiety", "worried", "worry", "frighten", "scared", "scares", "bleak", "pessimis", "struggl", "shameful", "angry", "furious", "abandon", "grim", "exhausted", "desperate", "cannot", "can't", "cutting back", "cut back", "squeez", "hard", "afraid"];

/** Heuristic tone for fake/dev mode (F2). The real LLM path assesses tone
 *  itself. Consumer content only — moderator lines are stripped upstream. */
export function heuristicSentiment(content: string): Sentiment {
  const lower = content.toLowerCase();
  const pos = POSITIVE_CUES.filter((c) => lower.includes(c)).length;
  const neg = NEGATIVE_CUES.filter((c) => lower.includes(c)).length;
  if (pos > 0 && neg > 0 && Math.abs(pos - neg) <= 1) return "mixed";
  if (neg > pos) return "negative";
  if (pos > neg) return "positive";
  return "neutral";
}

/**
 * OpenAI's structured-output mode requires every property to appear in the
 * schema's `required` array, so optional fields (`.default()`/`.optional()`)
 * are rejected outright. Declare these two as required-but-nullable instead
 * and normalise nulls after parsing — Anthropic accepts the same shape, so one
 * schema serves both providers.
 */
const suggestionSchema = z.object({
  chunks: z.array(
    z.object({
      seq: z.number(),
      themes: z.array(z.object({ name: z.string(), confidence: z.number().min(0).max(1) })),
      newThemeProposals: z.array(z.string()).nullable(),
      sentiment: z.enum(["positive", "negative", "neutral", "mixed"]).nullable(),
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
/**
 * The taxonomy as the model is shown it. A bare list of labels is a weak
 * instruction — "Housing" could mean cost, quality or moving plans — and the
 * researcher's definition is exactly what disambiguates it. Exported so a test
 * can assert the definitions really do reach the prompt.
 */
export function buildTaxonomyPromptLines(taxonomy: TaxonomyEntry[]): string[] {
  return [
    "Controlled theme taxonomy — tag ONLY with these, using each definition to decide:",
    ...taxonomy.map((t) => (t.definition?.trim() ? `- ${t.name}: ${t.definition.trim()}` : `- ${t.name}`)),
  ];
}

export async function suggestMetadata(
  chunks: ChunkDraft[],
  taxonomy: TaxonomyEntry[],
): Promise<{ suggestions: ChunkSuggestions[]; newThemeProposals: string[]; usage: SuggestUsage }> {
  const themeNames = taxonomy.map((t) => t.name);
  if (env.LLM_PROVIDER === "fake") {
    const proposals = new Set<string>();
    for (const c of chunks) for (const t of heuristicNewThemes(c.content)) if (!themeNames.includes(t)) proposals.add(t);
    return {
      suggestions: chunks.map((c) => ({
        seq: c.seq,
        themes: heuristicThemes(c.content, themeNames),
        pii: regexPii(c.content),
        sentiment: heuristicSentiment(c.content),
      })),
      newThemeProposals: [...proposals],
      usage: { inputTokens: 0, outputTokens: 0, model: "heuristic" },
    };
  }

  const { model, modelId } = getLlm("ingestion", await resolveModel("ingestion"));
  const prompt = [
    "You label qualitative research chunks for a research archive.",
    // A bare list of labels is a weak instruction: "Housing" could mean housing
    // costs, housing quality or moving plans. The researcher's own definition
    // is the thing that disambiguates it, so send it when there is one.
    ...buildTaxonomyPromptLines(taxonomy),
    "",
    "For each chunk: suggest up to 4 themes FROM THE TAXONOMY with confidence 0-1;",
    "propose genuinely new themes separately in newThemeProposals (rarely);",
    "assess the consumer's emotional tone as sentiment (positive|negative|neutral|mixed);",
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
      const proposals = new Set<string>();
      for (const c of result.object.chunks) {
        for (const p of c.newThemeProposals ?? []) {
          if (p.trim() && !themeNames.some((t) => t.toLowerCase() === p.trim().toLowerCase())) proposals.add(p.trim());
        }
      }
      await recordAiUsage({
        kind: "chat",
        model: modelId,
        feature: "ingest_suggest",
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      });
      return {
        suggestions: chunks.map((c) => {
          const s = bySeq.get(c.seq);
          const pii = [...(s?.pii ?? []), ...regexPii(c.content)];
          const seen = new Set<string>();
          return {
            seq: c.seq,
            themes: (s?.themes ?? []).filter((t) => themeNames.includes(t.name)),
            pii: pii.filter((p) => (seen.has(p.text) ? false : (seen.add(p.text), true))),
            sentiment: (s?.sentiment ?? "neutral") as Sentiment,
          };
        }),
        newThemeProposals: [...proposals],
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
