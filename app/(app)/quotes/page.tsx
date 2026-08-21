import { getFilterOptions } from "@/lib/services/filter-options";
import { getQuoteSuggestions } from "@/lib/services/suggestions";
import { requireUser } from "@/lib/session";
import { QuotesClient } from "./quotes-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find Quotes" };

export default async function QuotesPage() {
  const user = await requireUser();
  const [options, suggestions] = await Promise.all([getFilterOptions(), getQuoteSuggestions()]);
  return <QuotesClient options={options} hasTranscriptAccess={user.transcriptAccess} suggestions={suggestions} />;
}
