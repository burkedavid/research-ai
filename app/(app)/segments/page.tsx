import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { segments } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore Segments" };

export default async function SegmentsPage() {
  await requireUser();
  const rows = await db
    .select()
    .from(segments)
    .where(eq(segments.status, "active"))
    .orderBy(segments.name);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader icon="segments" title="Explore Segments" subtitle="Choose a segment to see the themes it raises most, the language it uses, and recent verbatim from those consumers." />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <Link key={s.id} href={`/segments/${s.id}`} className="group">
            <Card className="h-full transition group-hover:border-brand-600 group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-brand-900">{s.name}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
