import Link from "next/link";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getReviewQueue } from "@/lib/services/documents";
import { listWaves } from "@/lib/services/waves";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { env } from "@/lib/env";
import { CreateWaveForm } from "./create-wave-form";
import { BulkUploadForm } from "./bulk-upload-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function LibraryPage() {
  const user = await requireUser();
  const [waves, queue, projectRows] = await Promise.all([listWaves(), getReviewQueue(), db.select().from(projects)]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader icon="library" title="Library" subtitle="Waves, documents, upload and the review queue." />
      <p className="text-sm text-muted-foreground">
        <Link href="/library/outputs" className="underline underline-offset-4 hover:text-foreground">
          Saved outputs →
        </Link>
      </p>

      {queue.length > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50 ring-amber-200 dark:border-amber-900/50 dark:bg-amber-950/30 dark:ring-amber-900/50">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-200">Review queue ({queue.length})</CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300/80">
              Documents with extraction warnings are listed first — check those most carefully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {queue.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-sm ring-1 ring-foreground/5"
                >
                  <span>
                    <Link
                      href={`/library/documents/${d.id}`}
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {d.filename}
                    </Link>
                    <span className="ml-2 text-muted-foreground">
                      {d.sourceType} · wave {d.waveLabel}
                    </span>
                  </span>
                  {d.parseWarnings ? (
                    <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      {(d.parseWarnings as unknown[]).length} warning(s)
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">clean extraction</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Waves</h2>
        </div>
        {user.role !== "viewer" && projectRows.length > 0 && (
          <p className="mb-2 max-w-3xl text-sm text-muted-foreground">
            A <strong>wave</strong> is one month&apos;s fieldwork. Loading a back-catalogue of reports?{" "}
            <strong>Bulk upload</strong> reads the date from each filename and files it under the right month
            automatically. Adding this month&apos;s material by hand? Create the wave first, then upload into it.
          </p>
        )}
        {user.role !== "viewer" && projectRows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <CreateWaveForm projects={projectRows.map((p) => ({ id: p.id, name: p.name }))} />
            <BulkUploadForm
              projects={projectRows.map((p) => ({ id: p.id, name: p.name }))}
              storageDriver={env.STORAGE_DRIVER}
            />
          </div>
        )}
        <Card className="mt-4 py-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Wave</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waves.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No waves yet. Create the first wave to start uploading research.
                  </TableCell>
                </TableRow>
              )}
              {waves.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <Link
                      href={`/library/waves/${w.id}`}
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      Wave {w.waveNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {MONTHS[w.month]} {w.year}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{w.projectName}</TableCell>
                  <TableCell>
                    {w.indexedCount}/{w.documentCount} indexed
                  </TableCell>
                  <TableCell>
                    {w.status === "confirmed" ? (
                      <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                        {w.status}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{w.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
