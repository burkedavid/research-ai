import { USD_TO_GBP_FALLBACK } from "@/lib/config";

/**
 * Today's USD→GBP rate.
 *
 * Providers publish and bill in USD, so every cost figure has to cross a
 * currency boundary. Rather than bake a stale constant into the numbers, the
 * rate is fetched once a day from the ECB reference rates (via Frankfurter —
 * free, no key) and cached in memory. If the fetch fails we fall back to the
 * last known good rate rather than showing nothing, and say which was used.
 */
export interface FxRate {
  rate: number;
  /** date the rate is quoted for, e.g. "2026-08-21" */
  date: string;
  /** false when the live fetch failed and the fallback constant was used */
  live: boolean;
}

let cached: { value: FxRate; fetchedAt: number } | null = null;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function getUsdToGbp(): Promise<FxRate> {
  if (cached && Date.now() - cached.fetchedAt < ONE_DAY_MS) return cached.value;

  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP", {
      signal: AbortSignal.timeout(4000),
      // Next caches fetches aggressively by default; a daily rate needs revalidation
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const body = (await res.json()) as { date?: string; rates?: { GBP?: number } };
    const rate = body.rates?.GBP;
    if (typeof rate !== "number" || rate <= 0) throw new Error("fx missing GBP");
    const value: FxRate = { rate, date: body.date ?? new Date().toISOString().slice(0, 10), live: true };
    cached = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    // never let a rates outage break the admin page
    const value: FxRate = { rate: USD_TO_GBP_FALLBACK, date: "fallback", live: false };
    if (!cached) cached = { value, fetchedAt: Date.now() - ONE_DAY_MS + 60_000 }; // retry in a minute
    return value;
  }
}
