import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Starter questions and quote searches.
 *
 * These used to be hardcoded arrays, which meant they slowly drifted away from
 * whatever was actually in the archive — a suggestion that returns nothing is
 * worse than no suggestion, because it teaches a new user the tool is empty.
 *
 * Precedence, mirroring lib/services/model-settings.ts:
 *   admin override (app_settings) > derived from the indexed data > code default.
 */

export const KEYS = { ask: "suggestions.ask", quotes: "suggestions.quotes" } as const;
export type SuggestionKind = keyof typeof KEYS;

export interface AskSuggestion {
  /** grouping label shown above the question, e.g. a theme name */
  category: string;
  question: string;
}

/** Stored overrides are JSON; never trust raw JSON (AGENTS.md). */
const askSchema = z.array(z.object({ category: z.string().min(1).max(60), question: z.string().min(1).max(300) }));
const quotesSchema = z.array(z.string().min(1).max(120));

/** Last-resort defaults when the archive is empty and no admin override exists. */
export const DEFAULT_ASK: AskSuggestion[] = [
  { category: "Trends", question: "How has consumer confidence changed over the archive?" },
  { category: "Cost of living", question: "What do consumers say about cutting back?" },
  { category: "Banking", question: "How do consumers talk about trust in banks?" },
  { category: "Energy", question: "What were the biggest concerns about energy bills?" },
  { category: "Outlook", question: "How do consumers describe their hopes for the future?" },
  { category: "Segments", question: "Which segments sound most under pressure, and why?" },
];

export const DEFAULT_QUOTES: string[] = [
  "cutting back",
  "heating and energy bills",
  "trust in banks",
  "food shopping habits",
  "hopes for the future",
  "money worries",
];

async function readOverride(kind: SuggestionKind): Promise<unknown | null> {
  try {
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, [KEYS[kind]]));
    if (!rows[0]?.value) return null;
    return JSON.parse(rows[0].value);
  } catch {
    // missing table (pre-migration) or unparseable value must not break the page
    return null;
  }
}

export async function setSuggestions(kind: SuggestionKind, value: unknown | null, userId: string): Promise<void> {
  if (value === null) {
    await db.delete(appSettings).where(eq(appSettings.key, KEYS[kind]));
    return;
  }
  const parsed = kind === "ask" ? askSchema.parse(value) : quotesSchema.parse(value);
  const json = JSON.stringify(parsed);
  await db
    .insert(appSettings)
    .values({ key: KEYS[kind], value: json, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: json, updatedBy: userId, updatedAt: new Date() } });
}

interface ArchiveShape {
  themes: string[];
  segments: string[];
  firstYear: number | null;
  lastYear: number | null;
  /** waves holding indexed evidence — a change-over-time question needs at least two */
  waveCount: number;
}

/** What the archive actually contains right now, ordered by how much evidence backs it. */
async function readArchiveShape(): Promise<ArchiveShape> {
  try {
    const themeRows = (await db.execute(sql`
      SELECT t.name, count(*)::int AS n
      FROM chunk_themes ct
      JOIN themes t ON t.id = ct.theme_id
      JOIN chunks c ON c.id = ct.chunk_id
      JOIN documents d ON d.id = c.document_id
      WHERE d.status = 'indexed' AND t.status = 'active'
      GROUP BY t.name ORDER BY n DESC LIMIT 12
    `)) as unknown as { name: string }[];

    const segRows = (await db.execute(sql`
      SELECT s.name, count(*)::int AS n
      FROM chunks c
      JOIN segments s ON s.id = c.segment_id
      JOIN documents d ON d.id = c.document_id
      WHERE d.status = 'indexed'
      GROUP BY s.name ORDER BY n DESC LIMIT 5
    `)) as unknown as { name: string }[];

    const yearRows = (await db.execute(sql`
      SELECT min(w.year)::int AS first_year, max(w.year)::int AS last_year, count(*)::int AS wave_count
      FROM waves w
      WHERE EXISTS (SELECT 1 FROM documents d WHERE d.wave_id = w.id AND d.status = 'indexed')
    `)) as unknown as { first_year: number | null; last_year: number | null; wave_count: number }[];

    return {
      themes: themeRows.map((r) => r.name),
      segments: segRows.map((r) => r.name),
      firstYear: yearRows[0]?.first_year != null ? Number(yearRows[0].first_year) : null,
      lastYear: yearRows[0]?.last_year != null ? Number(yearRows[0].last_year) : null,
      waveCount: Number(yearRows[0]?.wave_count ?? 0),
    };
  } catch {
    return { themes: [], segments: [], firstYear: null, lastYear: null, waveCount: 0 };
  }
}

/** Strip a theme name down to something that reads naturally mid-sentence. */
function asTopic(theme: string): string {
  return theme.replace(/\s*\(.*\)\s*/g, "").toLowerCase();
}

function deriveAsk(shape: ArchiveShape): AskSuggestion[] {
  const out: AskSuggestion[] = [];
  // A change-over-time question is the archive's whole point, so offer it
  // whenever there is more than one wave — not only when the waves happen to
  // straddle a new year. An archive of monthly 2026 waves is still a trend.
  const spansYears = shape.firstYear != null && shape.lastYear != null && shape.lastYear > shape.firstYear;
  const canTrend = shape.waveCount > 1 && Boolean(shape.themes[0]);

  if (canTrend) {
    const period = spansYears ? `between ${shape.firstYear} and ${shape.lastYear}` : "across the waves so far";
    out.push({
      category: shape.themes[0],
      question: `How has ${asTopic(shape.themes[0])} changed ${period}?`,
    });
  }
  for (const theme of shape.themes.slice(canTrend ? 1 : 0, 4)) {
    out.push({ category: theme, question: `What do consumers say about ${asTopic(theme)}?` });
  }
  if (shape.segments[0] && shape.themes[0]) {
    out.push({
      category: shape.segments[0],
      question: `How have ${shape.segments[0]} talked about ${asTopic(shape.themes[0])}?`,
    });
  }
  if (shape.themes[1]) {
    out.push({ category: "Segments", question: `Which segments talk most about ${asTopic(shape.themes[1])}?` });
  }
  return out.slice(0, 6);
}

function deriveQuotes(shape: ArchiveShape): string[] {
  return shape.themes.slice(0, 6).map(asTopic);
}

/** Starter questions for Ask the Archive. */
export async function getAskSuggestions(): Promise<AskSuggestion[]> {
  const override = await readOverride("ask");
  if (override) {
    const parsed = askSchema.safeParse(override);
    if (parsed.success && parsed.data.length > 0) return parsed.data;
  }
  const derived = deriveAsk(await readArchiveShape());
  return derived.length > 0 ? derived : DEFAULT_ASK;
}

/** Starter searches for the Quotes page. */
export async function getQuoteSuggestions(): Promise<string[]> {
  const override = await readOverride("quotes");
  if (override) {
    const parsed = quotesSchema.safeParse(override);
    if (parsed.success && parsed.data.length > 0) return parsed.data;
  }
  const derived = deriveQuotes(await readArchiveShape());
  return derived.length > 0 ? derived : DEFAULT_QUOTES;
}

/** For the admin editor: what is stored, and what the data would give on its own. */
export async function getSuggestionSettings(): Promise<{
  ask: { override: AskSuggestion[] | null; derived: AskSuggestion[] };
  quotes: { override: string[] | null; derived: string[] };
}> {
  const shape = await readArchiveShape();
  const [askOverride, quotesOverride] = await Promise.all([readOverride("ask"), readOverride("quotes")]);
  const askParsed = askOverride ? askSchema.safeParse(askOverride) : null;
  const quotesParsed = quotesOverride ? quotesSchema.safeParse(quotesOverride) : null;
  const derivedAsk = deriveAsk(shape);
  const derivedQuotes = deriveQuotes(shape);
  return {
    ask: {
      override: askParsed?.success ? askParsed.data : null,
      derived: derivedAsk.length > 0 ? derivedAsk : DEFAULT_ASK,
    },
    quotes: {
      override: quotesParsed?.success ? quotesParsed.data : null,
      derived: derivedQuotes.length > 0 ? derivedQuotes : DEFAULT_QUOTES,
    },
  };
}
