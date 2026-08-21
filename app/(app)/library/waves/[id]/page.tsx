import Link from "next/link";
import { notFound } from "next/navigation";
import { getWaveWithDocuments } from "@/lib/services/waves";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadForm } from "./upload-form";
import { ConfirmWaveButton } from "./confirm-wave-button";
import { WaveSettings } from "./wave-settings";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS_STYLES: Record<string, string> = {
  indexed: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  review: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  approved: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  parsing: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  uploaded: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  failed: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  deleted: "border-transparent bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};

export default async function WavePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getWaveWithDocuments(id);
  if (!data) notFound();
  const { wave, documents } = data;

  const canEdit = user.role !== "viewer";
  const allSettled = documents.length > 0 && documents.every((d) => ["indexed", "failed", "deleted"].includes(d.status));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/library" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        ← Library
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Wave {wave.waveNumber} — {MONTHS[wave.month]} {wave.year}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {wave.projectName}
            {wave.keyEvents?.length ? ` · ${wave.keyEvents.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {wave.status === "confirmed" ? (
            <Badge className="border-transparent bg-green-100 px-3 py-1 text-sm text-green-800 dark:bg-green-900/50 dark:text-green-200">
              {wave.status}
            </Badge>
          ) : (
            <Badge variant="secondary" className="px-3 py-1 text-sm">
              {wave.status}
            </Badge>
          )}
          {canEdit && wave.status !== "confirmed" && <ConfirmWaveButton waveId={wave.id} disabled={!allSettled} />}
          {canEdit && wave.status !== "confirmed" && (
            <WaveSettings
              waveId={wave.id}
              waveNumber={wave.waveNumber}
              month={wave.month}
              year={wave.year}
              keyEvents={wave.keyEvents ?? []}
              documentCount={documents.length}
              canDelete={user.role === "admin"}
            />
          )}
        </div>
      </div>

      {canEdit && <UploadForm waveId={wave.id} storageDriver={env.STORAGE_DRIVER} />}

      <Card className="mt-6 py-0">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Report date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Warnings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No documents uploaded to this wave yet.
                </TableCell>
              </TableRow>
            )}
            {documents.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link
                    href={`/library/documents/${d.id}`}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {d.filename}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.reportDate ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{d.sourceType.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-muted-foreground">v{d.version}</TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLES[d.status] ?? ""}>{d.status}</Badge>
                  {d.error && <span className="ml-2 text-xs text-destructive">{d.error}</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {Array.isArray(d.parseWarnings) && d.parseWarnings.length > 0 ? (
                    <Link
                      href={`/library/documents/${d.id}`}
                      title={(d.parseWarnings as { message: string }[]).map((w) => w.message).join("\n")}
                      className="text-amber-700 underline underline-offset-2"
                    >
                      {d.parseWarnings.length} warning{d.parseWarnings.length === 1 ? "" : "s"} — open to view
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
