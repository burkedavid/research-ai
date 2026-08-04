import { describe, expect, it } from "vitest";
import { countTerms, tokenize } from "@/lib/text/word-frequency";

describe("word & phrase frequency counting (item 4)", () => {
  it("counts repeated content words and ignores stopwords", () => {
    const texts = [
      "The economy feels weak and prices keep rising.",
      "Prices are rising and the economy feels uncertain.",
      "Rising prices worry me about the economy.",
    ];
    const { words } = countTerms(texts, { minWordCount: 2 });
    const map = Object.fromEntries(words.map((w) => [w.term, w.count]));
    expect(map.economy).toBe(3);
    expect(map.prices).toBe(3);
    expect(map.rising).toBe(3);
    // stopwords never appear
    expect(words.some((w) => ["the", "and", "are", "about"].includes(w.term))).toBe(false);
    // sorted by descending count
    expect(words[0].count).toBeGreaterThanOrEqual(words[words.length - 1].count);
  });

  it("extracts multi-word phrases, allowing an internal stopword", () => {
    const texts = [
      "The cost of living keeps climbing.",
      "Everyone talks about the cost of living these days.",
      "cost of living pressures are everywhere.",
    ];
    const { phrases } = countTerms(texts, { minPhraseCount: 2 });
    const terms = phrases.map((p) => p.term);
    // "cost of living" survives (of is internal), "of living" / "the cost" do not
    expect(terms).toContain("cost of living");
    expect(terms).not.toContain("of living");
    expect(terms.some((t) => t.startsWith("the "))).toBe(false);
  });

  it("drops terms seen only once (not 'common') and respects caps", () => {
    const texts = ["unique singleton words here", "common common common repeated repeated"];
    const { words } = countTerms(texts, { minWordCount: 2, maxWords: 1 });
    expect(words.length).toBe(1);
    expect(words[0].term).toBe("common");
    expect(words.some((w) => w.term === "singleton")).toBe(false);
  });

  it("tokenises to lowercase letter-runs, stripping punctuation and apostrophes", () => {
    expect(tokenize("Don't worry — it's the ECONOMY, stupid!")).toEqual([
      "dont",
      "worry",
      "its",
      "the",
      "economy",
      "stupid",
    ]);
  });
});
