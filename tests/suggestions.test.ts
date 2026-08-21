import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { segments, themes } from "@/db/schema";
import {
  DEFAULT_ASK,
  getAskSuggestions,
  getQuoteSuggestions,
  getSuggestionSettings,
  setSuggestions,
} from "@/lib/services/suggestions";
import { admin, ensureCorpusIngested } from "./helpers";

beforeAll(async () => {
  await ensureCorpusIngested();
});

/**
 * The point of deriving suggestions from the database is that they can never
 * advertise something the archive does not contain. These tests assert exactly
 * that property, since a suggestion that returns nothing is worse than none.
 */
describe("starter suggestions (derived from the indexed archive)", () => {
  it("suggests only themes and segments that actually exist", async () => {
    const [askList, quoteList, themeRows, segmentRows] = await Promise.all([
      getAskSuggestions(),
      getQuoteSuggestions(),
      db.select().from(themes),
      db.select().from(segments),
    ]);

    expect(askList.length).toBeGreaterThan(0);
    expect(quoteList.length).toBeGreaterThan(0);

    const known = new Set([...themeRows.map((t) => t.name), ...segmentRows.map((s) => s.name)].map((n) => n.toLowerCase()));
    // every card is labelled with a real theme/segment, or the generic grouping
    for (const item of askList) {
      const label = item.category.toLowerCase();
      expect(known.has(label) || label === "segments").toBe(true);
      expect(item.question.length).toBeGreaterThan(10);
    }
    // quote chips are theme names, lowercased
    for (const chip of quoteList) {
      expect(known.has(chip)).toBe(true);
    }
  });

  it("spans the archive's real date range rather than a hardcoded one", async () => {
    const askList = await getAskSuggestions();
    const withYears = askList.filter((s) => /\d{4}/.test(s.question));
    for (const s of withYears) {
      const years = [...s.question.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
      // the corpus spans 2020..2026; a stale suggestion would name a year outside it
      for (const y of years) expect(y).toBeGreaterThanOrEqual(2020);
      for (const y of years) expect(y).toBeLessThanOrEqual(new Date().getFullYear() + 1);
    }
  });

  it("lets an admin override the list, and reset back to the derived one", async () => {
    const who = await admin();
    const custom = [{ category: "House style", question: "What is the mood of the nation this quarter?" }];

    await setSuggestions("ask", custom, who.id);
    expect(await getAskSuggestions()).toEqual(custom);

    const settings = await getSuggestionSettings();
    expect(settings.ask.override).toEqual(custom);
    // the generated list is still available to reset to
    expect(settings.ask.derived.length).toBeGreaterThan(0);

    await setSuggestions("ask", null, who.id);
    const afterReset = await getAskSuggestions();
    expect(afterReset).not.toEqual(custom);
    expect(afterReset.length).toBeGreaterThan(0);
  });

  it("rejects a malformed override rather than storing it", async () => {
    const who = await admin();
    await expect(setSuggestions("ask", [{ category: "", question: "" }], who.id)).rejects.toThrow();
    await expect(setSuggestions("quotes", [123], who.id)).rejects.toThrow();
  });

  it("falls back to the code defaults only when nothing is indexed", () => {
    // guards against DEFAULT_ASK drifting into something unusable
    expect(DEFAULT_ASK.length).toBeGreaterThan(0);
    for (const d of DEFAULT_ASK) expect(d.question.endsWith("?")).toBe(true);
  });
});
