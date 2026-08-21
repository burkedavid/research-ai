import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { generateText } from "ai";
import { db } from "@/db";
import { waves } from "@/db/schema";
import { recordAiUsage } from "@/lib/ai-usage";
import { audit } from "@/lib/audit";
import { VERSIONS } from "@/lib/config";
import type { SessionUser } from "@/lib/errors";
import { getLlm } from "@/lib/llm";
import { resolveModel } from "@/lib/services/model-settings";
import { ASK_SYSTEM_PROMPT, PROMPT_VERSION, buildAskUserMessage } from "@/lib/prompts/ask";
import { computeEvidentialBasis, type EvidentialBasis } from "@/lib/retrieval/confidence";
import { searchChunks, type SearchFilters } from "@/lib/retrieval/search";
import { buildCitations, verifyAnswer, type Citation } from "@/lib/retrieval/verify";
import { comparePeriods } from "./compare";
import { estimateCostGbp } from "./ask";

export type ReportTemplate = "monthly_summary" | "theme_deep_dive" | "what_changed" | "deep_briefing";

export interface ReportSection {
  heading: string;
  text: string;
  citations: Citation[];
  basis: EvidentialBasis | null;
  quoteVerified: boolean;
}

export interface ReportDraft {
  title: string;
  template: ReportTemplate;
  sections: ReportSection[];
  provenance: {
    model: string;
    promptVersion: string;
    retrievalVersion: string;
    embeddingModel: string;
    usage: { input_tokens: number; output_tokens: number; est_cost_gbp: number };
  };
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MONTHLY_SECTIONS: { heading: string; query: string }[] = [
  { heading: "Overall mood and confidence", query: "overall mood confidence how consumers are feeling" },
  { heading: "Cost of living and household finances", query: "cost of living money household finances budget pressure" },
  { heading: "Energy and fuel", query: "energy bills heating gas electricity fuel costs" },
  { heading: "Food shopping", query: "food shopping supermarket groceries habits" },
  { heading: "Banks and financial services", query: "banks banking financial services trust experience" },
  { heading: "Outlook", query: "future outlook hopes worries next year" },
];

async function generateSection(params: {
  user: SessionUser;
  heading: string;
  query: string;
  filters: SearchFilters;
}): Promise<{ section: ReportSection; inputTokens: number; outputTokens: number; embeddingModel: string }> {
  const retrieval = await searchChunks({ query: params.query, filters: params.filters, user: params.user, k: 8 });
  if (retrieval.chunks.length === 0) {
    return {
      section: {
        heading: params.heading,
        text: "No evidence was found for this section with the selected scope. This topic may not have been discussed, or it may sit outside the current filters.",
        citations: [],
        basis: null,
        quoteVerified: true,
      },
      inputTokens: 0,
      outputTokens: 0,
      embeddingModel: retrieval.embeddingModel,
    };
  }

  const chosen = await resolveModel("query");
  const { model, modelId: usedModel } = getLlm("query", chosen);
  const result = await generateText({
    model,
    system: ASK_SYSTEM_PROMPT,
    prompt: buildAskUserMessage(
      `Write the "${params.heading}" section of a research report. 2-3 paragraphs, grounded and cited, with at most one strong verbatim quote.`,
      retrieval.chunks,
    ),
  });
  await recordAiUsage({
    kind: "chat",
    model: usedModel,
    feature: "report",
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    userId: params.user.id,
  });
  const verification = verifyAnswer(result.text, retrieval.chunks);
  return {
    section: {
      heading: params.heading,
      text: result.text,
      citations: buildCitations(retrieval.chunks),
      basis: computeEvidentialBasis(retrieval.chunks),
      quoteVerified: verification.allQuotesVerified,
    },
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    embeddingModel: retrieval.embeddingModel,
  };
}

/** Create Report (§B8): templates orchestrating multiple retrievals into an
 *  editable, cited draft. */
export async function generateReport(params: {
  user: SessionUser;
  template: ReportTemplate;
  waveId?: string;
  themeId?: string;
  themeName?: string;
  /** free-text research question — required for deep_briefing (F6) */
  question?: string;
  /** optional retrieval scope for deep_briefing (date range, segments, etc.) */
  filters?: SearchFilters;
  ip?: string | null;
}): Promise<ReportDraft> {
  const { user, template } = params;
  const { modelId } = getLlm("query", await resolveModel("query"));
  let totalIn = 0;
  let totalOut = 0;
  let embeddingModel = "";
  const sections: ReportSection[] = [];
  let title = "Research report";

  await audit({
    userId: user.id,
    action: "search",
    detail: { feature: "report", template, queryHash: createHash("sha256").update(template + (params.waveId ?? "") + (params.themeId ?? "") + (params.question ?? "")).digest("hex").slice(0, 32) },
    ip: params.ip,
  });

  if (template === "monthly_summary") {
    if (!params.waveId) throw new Error("monthly_summary requires a waveId");
    const [wave] = await db.select().from(waves).where(eq(waves.id, params.waveId));
    if (!wave) throw new Error("Wave not found");
    title = `Consumer Sentiment Summary — ${MONTHS[wave.month]} ${wave.year}`;
    for (const spec of MONTHLY_SECTIONS) {
      const { section, inputTokens, outputTokens, embeddingModel: em } = await generateSection({
        user,
        heading: spec.heading,
        query: spec.query,
        filters: { waveIds: [params.waveId] },
      });
      sections.push(section);
      totalIn += inputTokens;
      totalOut += outputTokens;
      embeddingModel = em;
    }
  } else if (template === "theme_deep_dive") {
    if (!params.themeId) throw new Error("theme_deep_dive requires a themeId");
    const themeName = params.themeName ?? "the selected theme";
    title = `Theme deep dive — ${themeName}`;
    const specs = [
      { heading: "How the theme has evolved over time", query: `${themeName} change over time` },
      { heading: "Segment differences", query: `${themeName} differences between consumer groups` },
      { heading: "Consumer voice", query: `${themeName} consumer experiences feelings verbatim` },
    ];
    for (const spec of specs) {
      const { section, inputTokens, outputTokens, embeddingModel: em } = await generateSection({
        user,
        heading: spec.heading,
        query: spec.query,
        filters: { themeIds: [params.themeId] },
      });
      sections.push(section);
      totalIn += inputTokens;
      totalOut += outputTokens;
      embeddingModel = em;
    }
  } else if (template === "deep_briefing") {
    // Deep-research structured briefing (F6): decompose a free-text research
    // question into fixed research lenses, retrieve + synthesise each with
    // citations, over an optional shared scope. Reuses the cited-section engine.
    const question = params.question?.trim();
    if (!question) throw new Error("deep_briefing requires a question");
    title = `Deep-research briefing — ${question.length > 90 ? `${question.slice(0, 90)}…` : question}`;
    const lenses: { heading: string; query: string }[] = [
      { heading: "Overview", query: question },
      { heading: "Main themes", query: `${question} — the main themes and recurring points consumers raise` },
      { heading: "Differences by segment and region", query: `${question} — how views differ by consumer segment and region` },
      { heading: "How it has changed over time", query: `${question} — how this has changed across waves over time` },
      { heading: "Supporting consumer voice", query: `${question} — consumer experiences, feelings and verbatim` },
    ];
    for (const spec of lenses) {
      const { section, inputTokens, outputTokens, embeddingModel: em } = await generateSection({
        user,
        heading: spec.heading,
        query: spec.query,
        filters: params.filters ?? {},
      });
      sections.push(section);
      totalIn += inputTokens;
      totalOut += outputTokens;
      embeddingModel = em;
    }
  } else {
    // what_changed (§A10.7): latest wave vs previous wave and vs same month last year
    if (!params.waveId) throw new Error("what_changed requires a waveId");
    const [wave] = await db.select().from(waves).where(eq(waves.id, params.waveId));
    if (!wave) throw new Error("Wave not found");
    title = `What has changed — ${MONTHS[wave.month]} ${wave.year}`;

    const allWaves = await db.select().from(waves);
    const sorted = allWaves
      .filter((w) => w.year * 100 + w.month < wave.year * 100 + wave.month)
      .sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
    const previous = sorted[0];
    const [sameMonthLastYear] = await db
      .select()
      .from(waves)
      .where(and(eq(waves.month, wave.month), eq(waves.year, wave.year - 1)));

    const comparisons = [
      previous && {
        label: `vs previous wave (${MONTHS[previous.month]} ${previous.year})`,
        other: previous,
      },
      sameMonthLastYear && {
        label: `vs same month last year (${MONTHS[sameMonthLastYear.month]} ${sameMonthLastYear.year})`,
        other: sameMonthLastYear,
      },
    ].filter(Boolean) as { label: string; other: typeof wave }[];

    if (comparisons.length === 0) {
      sections.push({
        heading: "No comparison periods available",
        text: "This is the earliest wave in the archive, so there is no previous wave or prior-year wave to compare against.",
        citations: [],
        basis: null,
        quoteVerified: true,
      });
    }

    for (const cmp of comparisons) {
      const result = await comparePeriods({
        user,
        question: "What has changed in consumer sentiment, concerns and behaviour?",
        labelA: `${MONTHS[cmp.other.month]} ${cmp.other.year}`,
        filtersA: { waveIds: [cmp.other.id] },
        labelB: `${MONTHS[wave.month]} ${wave.year}`,
        filtersB: { waveIds: [wave.id] },
        ip: params.ip,
      });
      sections.push({
        heading: cmp.label,
        text: result.text,
        citations: [
          ...result.sideA.citations.map((c) => ({ ...c, filename: `A: ${c.filename}` })),
          ...result.sideB.citations.map((c) => ({ ...c, filename: `B: ${c.filename}` })),
        ],
        basis: result.sideB.basis,
        quoteVerified: true,
      });
      totalIn += result.provenance.usage.input_tokens;
      totalOut += result.provenance.usage.output_tokens;
      embeddingModel = result.provenance.embeddingModel;
    }
  }

  return {
    title,
    template,
    sections,
    provenance: {
      model: modelId,
      promptVersion: PROMPT_VERSION,
      retrievalVersion: VERSIONS.retrieval,
      embeddingModel,
      usage: {
        input_tokens: totalIn,
        output_tokens: totalOut,
        est_cost_gbp: estimateCostGbp(modelId, totalIn, totalOut),
      },
    },
  };
}
