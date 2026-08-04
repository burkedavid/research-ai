import { getTrendData } from "@/lib/services/trends";
import { requireUser } from "@/lib/session";
import { TrendsClient } from "./trends-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trends" };

export default async function TrendsPage() {
  const user = await requireUser();
  const data = await getTrendData(user);
  return <TrendsClient data={data} canSynthesise={Boolean(data.earliest && data.latest)} />;
}
