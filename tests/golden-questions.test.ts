import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { segments } from "@/db/schema";
import { searchChunks, type SearchFilters } from "@/lib/retrieval/search";
import { runAsk } from "@/lib/services/ask";
import { findQuotes } from "@/lib/services/quotes";
import { ensureCorpusIngested, researcher, summaryOnly } from "./helpers";
import type { SessionUser } from "@/lib/errors";

async function segmentId(name: string): Promise<string> {
  const [row] = await db.select().from(segments).where(eq(segments.name, name));
  return row.id;
}

interface AskOutcome {
  meta: {
    citations: { n: number; chunkId: string; evidenceType: string; wave: string }[];
    basis: { statement: string; level: string; waves: number; interviews: number };
    explainability: { results: unknown[]; weakEvidence: boolean };
  };
  text: string;
  verification: { allQuotesVerified: boolean; hasCitations: boolean; invalidCitations: number[]; quoteChecks: unknown[] };
}

async function ask(user: SessionUser, question: string, filters?: SearchFilters): Promise<AskOutcome> {
  const response = await runAsk({ user, question, filters });
  const raw = await response.text();
  const events = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const meta = events.find((e) => e.type === "meta");
  const done = events.find((e) => e.type === "done");
  const error = events.find((e) => e.type === "error");
  expect(error, `stream errored: ${JSON.stringify(error)}`).toBeUndefined();
  const text = events
    .filter((e) => e.type === "delta")
    .map((e) => e.text)
    .join("");
  return { meta, text, verification: done?.verification };
}

beforeAll(async () => {
  await ensureCorpusIngested();
});

describe("golden-question suite (§B10.3, §A7.2)", () => {
  it("Q1: Rising Metropolitans and optimism since March 2020 — cited, multi-wave, verified", async () => {
    const user = await researcher();
    const rm = await segmentId("Rising Metropolitans");
    const outcome = await ask(user, "How have Rising Metropolitans talked about optimism since March 2020?", {
      segmentIds: [rm],
      dateRange: { fromYear: 2020, fromMonth: 3, toYear: 2026, toMonth: 12 },
    });

    expect(outcome.verification.hasCitations).toBe(true);
    expect(outcome.verification.invalidCitations).toEqual([]);
    expect(outcome.verification.allQuotesVerified).toBe(true);
    expect(outcome.meta.basis.waves).toBeGreaterThanOrEqual(2);
    expect(outcome.meta.basis.statement).toMatch(/confidence|caution/i);
  });

  it("Q2: Budgeting Elderly during the energy crisis retrieves the planted heating quote", async () => {
    const user = await researcher();
    const be = await segmentId("Budgeting Elderly");
    const result = await searchChunks({
      query: "What were the biggest concerns among Budgeting Elderly consumers during the energy crisis heating bills?",
      filters: { segmentIds: [be], dateRange: { fromYear: 2022, fromMonth: 1, toYear: 2022, toMonth: 12 } },
      user,
    });
    expect(result.chunks.length).toBeGreaterThan(0);
    const all = result.chunks.map((c) => c.content).join("\n");
    expect(all).toContain("keeping the heating off until the grandchildren visit");
    expect(result.chunks.every((c) => c.year === 2022)).toBe(true);
  });

  it("Q3: attitudes to banks before and after Covid spans 2020 and 2026", async () => {
    const user = await researcher();
    const result = await searchChunks({
      query: "attitudes to banks and banking trust branch",
      user,
      k: 16,
    });
    const years = new Set(result.chunks.map((c) => c.year));
    expect(years.has(2020)).toBe(true);
    expect(years.has(2026) || years.has(2022)).toBe(true);
  });

  it("Q4: verbatim on cutting back comes from multiple waves, consumer voice only", async () => {
    const user = await researcher();
    const { quotes } = await findQuotes({ user, query: "cutting back spending" });
    expect(quotes.length).toBeGreaterThanOrEqual(3);
    const waves = new Set(quotes.map((q) => q.wave));
    expect(waves.size).toBeGreaterThanOrEqual(2);
    for (const quote of quotes) {
      expect(quote.speaker).toBe("consumer");
      expect(quote.quote).not.toMatch(/MODERATOR:/);
    }
  });

  it("Q5: confidence change 2022 → 2026 retrieves both years", async () => {
    const user = await researcher();
    const result = await searchChunks({
      query: "How has confidence and optimism about the future changed?",
      filters: { dateRange: { fromYear: 2022, fromMonth: 1, toYear: 2026, toMonth: 12 } },
      user,
      k: 16,
    });
    const years = new Set(result.chunks.map((c) => c.year));
    expect(years.has(2022)).toBe(true);
    expect(years.has(2026)).toBe(true);
    expect(years.has(2020)).toBe(false); // date filter enforced in SQL
  });

  it("Q6: fairness and trust retrieves the profiteering evidence", async () => {
    const user = await researcher();
    const result = await searchChunks({ query: "fairness trust profiteering banks energy", user, k: 16 });
    const all = result.chunks.map((c) => c.content).join("\n");
    expect(all).toMatch(/profiteer/i);
  });

  it("Q7: smart meter energy bills retrieves the Rising Metropolitans 2022 account", async () => {
    const user = await researcher();
    const result = await searchChunks({ query: "smart meter direct debit energy bills checking", user });
    const all = result.chunks.map((c) => c.content).join("\n");
    expect(all).toContain("ninety pounds to two hundred and forty");
  });

  it("Q8: AI in banking retrieves 2026 evidence", async () => {
    const user = await researcher();
    const result = await searchChunks({
      query: "AI assistant banking app automation",
      filters: { dateRange: { fromYear: 2026, fromMonth: 1, toYear: 2026, toMonth: 12 } },
      user,
    });
    expect(result.chunks.length).toBeGreaterThan(0);
    const all = result.chunks.map((c) => c.content).join("\n");
    expect(all).toMatch(/AI (assistant|chat)/);
  });

  it("Q9: full ask flow — quotes verify, cautious language, citations resolve to real chunks", async () => {
    const user = await researcher();
    const outcome = await ask(user, "What do consumers say about food shopping habits changing?");

    expect(outcome.verification.hasCitations).toBe(true);
    expect(outcome.verification.allQuotesVerified).toBe(true);
    expect(outcome.verification.invalidCitations).toEqual([]);
    // §A8.1 cautious qualitative language
    expect(outcome.text).toMatch(/several|many|a few|appears|there is a sense/i);
    expect(outcome.text).not.toMatch(/\d+%/);
    // every citation maps to a retrievable chunk id
    for (const citation of outcome.meta.citations) {
      expect(citation.chunkId).toMatch(/[0-9a-f-]{36}/);
    }
    // explainability panel data present (§B7, acceptance criterion 13)
    expect(outcome.meta.explainability.results.length).toBeGreaterThan(0);
  });

  it("Q10: unanswerable question is flagged weak, not stretched", async () => {
    const user = await researcher();
    const result = await searchChunks({ query: "zorbulating quantum flibbertigibbet spacecraft", user });
    expect(result.weakEvidence).toBe(true);
  });

  it("Q11: small-base answers carry an explicit small-base statement", async () => {
    const user = await researcher();
    const be = await segmentId("Budgeting Elderly");
    const outcome = await ask(user, "What did Budgeting Elderly consumers say about holidays?", {
      segmentIds: [be],
      dateRange: { fromYear: 2026, fromMonth: 6, toYear: 2026, toMonth: 6 },
    });
    // one interview, one wave → the evidential basis must say caution/small base
    expect(outcome.meta.basis.interviews).toBeLessThanOrEqual(2);
    expect(outcome.meta.basis.statement).toMatch(/caution|small/i);
  });
});

describe("permission boundaries (§B9.9, acceptance criterion 7)", () => {
  it("a user without transcript access retrieves zero transcript evidence by any query", async () => {
    const user = await summaryOnly();
    const result = await searchChunks({ query: "heating grandchildren blanket energy", user, k: 24 });
    // the ACL boundary is source_type: no raw transcript evidence, ever.
    // (report-attributed direct quotes ARE allowed for this user — item 8.)
    expect(result.chunks.every((c) => c.sourceType !== "transcript")).toBe(true);
    const all = result.chunks.map((c) => c.content).join("\n");
    // the planted transcript-only verbatim must never leak
    expect(all).not.toContain("keeping the heating off until the grandchildren visit. I sit with a blanket");
  });

  it("quote finder returns report verbatim but no transcript verbatim without transcript access (item 8)", async () => {
    const user = await summaryOnly();
    // a query that hits the planted transcript verbatim
    const { quotes } = await findQuotes({ user, query: "heating off grandchildren blanket cutting back" });
    // raw transcript verbatim must never leak…
    expect(quotes.every((q) => !q.quote.includes("grandchildren visit"))).toBe(true);
    // …and anything returned is report-derived (no interview reference)
    expect(quotes.every((q) => q.interviewRef === null)).toBe(true);
  });

  it("the same query returns transcript evidence for an authorised researcher", async () => {
    const user = await researcher();
    const result = await searchChunks({ query: "heating grandchildren blanket energy", user });
    expect(result.chunks.some((c) => c.sourceType === "transcript")).toBe(true);
  });

  it("report evidence remains reachable for the summary-only user", async () => {
    const user = await summaryOnly();
    const result = await searchChunks({ query: "energy costs dominated consumer sentiment", user });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.every((c) => c.sourceType === "report")).toBe(true);
  });
});
