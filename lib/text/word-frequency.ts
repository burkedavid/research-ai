/**
 * Word and phrase frequency counting (item 4). Pure and deterministic so it can
 * be unit-tested without a database or provider. Used by the word-frequency
 * service to answer "the most common words/phrases in this period / about this
 * topic". Phrases are stopword-aware n-grams: a phrase may contain a stopword
 * internally ("cost of living") but never begin or end with one ("of the").
 */

export interface FrequencyItem {
  term: string;
  count: number;
}

/** Common English function words + interview/research filler, excluded from
 *  word counts and from the ends of phrases. */
export const STOPWORDS = new Set(
  (
    "the a an and or but if then than that this these those i we you they he she it me us them him her " +
    "my our your their his its is are was were be been being am have has had do does did doing will would " +
    "could should shall can may might must not no nor so to of in on at by for with as about against " +
    "between into through during before after above below from up down out off over under again further " +
    "once here there when where why how all any both each few more most other some such only own same too " +
    "very just dont im ive its thats weve youre theyre also really quite still even much many lot lots " +
    "think feel felt feeling like really things thing bit going get got said say says one two get really " +
    "im youre theres its whats ive were theyve people consumer consumers"
  ).split(/\s+/),
);

/** Split into lowercase word tokens, keeping stopwords for phrase adjacency. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const isContentWord = (w: string) => w.length >= 3 && !STOPWORDS.has(w);

/**
 * Count single words and 2–3 word phrases across many texts. Words with fewer
 * than `minWordCount` and phrases with fewer than `minPhraseCount` occurrences
 * are dropped (a term seen once is not "common"). Returns the top `maxWords`
 * words and top `maxPhrases` phrases, each sorted by descending count.
 */
export function countTerms(
  texts: string[],
  opts: { maxWords?: number; maxPhrases?: number; minWordCount?: number; minPhraseCount?: number } = {},
): { words: FrequencyItem[]; phrases: FrequencyItem[] } {
  const maxWords = opts.maxWords ?? 40;
  const maxPhrases = opts.maxPhrases ?? 25;
  const minWordCount = opts.minWordCount ?? 2;
  const minPhraseCount = opts.minPhraseCount ?? 2;

  const wordCounts = new Map<string, number>();
  const phraseCounts = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const text of texts) {
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (isContentWord(t)) bump(wordCounts, t);

      // bigram: both ends must be content words
      if (i + 1 < tokens.length) {
        const a = tokens[i];
        const b = tokens[i + 1];
        if (isContentWord(a) && isContentWord(b)) bump(phraseCounts, `${a} ${b}`);
      }
      // trigram: ends must be content words; the middle may be a stopword
      if (i + 2 < tokens.length) {
        const a = tokens[i];
        const mid = tokens[i + 1];
        const c = tokens[i + 2];
        if (isContentWord(a) && isContentWord(c) && mid.length >= 2) bump(phraseCounts, `${a} ${mid} ${c}`);
      }
    }
  }

  const top = (map: Map<string, number>, min: number, max: number): FrequencyItem[] =>
    [...map.entries()]
      .filter(([, count]) => count >= min)
      .map(([term, count]) => ({ term, count }))
      .sort((x, y) => y.count - x.count || x.term.localeCompare(y.term))
      .slice(0, max);

  return {
    words: top(wordCounts, minWordCount, maxWords),
    phrases: top(phraseCounts, minPhraseCount, maxPhrases),
  };
}
