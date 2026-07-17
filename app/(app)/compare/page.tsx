import { getFilterOptions } from "@/lib/services/filter-options";
import { requireUser } from "@/lib/session";
import { CompareClient } from "./compare-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare Time Periods" };

export default async function ComparePage() {
  await requireUser();
  const options = await getFilterOptions();
  return <CompareClient options={options} />;
}
