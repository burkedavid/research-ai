import { getFilterOptions } from "@/lib/services/filter-options";
import { requireUser } from "@/lib/session";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create Report" };

export default async function ReportsPage() {
  await requireUser();
  const options = await getFilterOptions();
  return <ReportsClient options={options} />;
}
