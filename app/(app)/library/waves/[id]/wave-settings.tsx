"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Correct a wave's details, or delete one created by mistake (e.g. from a
 * mistyped filename during bulk upload). Only shown while the wave is still a
 * draft — a confirmed wave is locked server-side too.
 */
export function WaveSettings({
  waveId,
  waveNumber,
  month,
  year,
  keyEvents,
  documentCount,
  canDelete,
}: {
  waveId: string;
  waveNumber: number;
  month: number;
  year: number;
  keyEvents: string[];
  documentCount: number;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const events = String(form.get("keyEvents") ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch(`/api/waves/${waveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waveNumber: Number(form.get("waveNumber")),
        month: Number(form.get("month")),
        year: Number(form.get("year")),
        keyEvents: events,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not update wave");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this wave? It has no documents, and this cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/waves/${waveId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not delete wave");
      return;
    }
    router.push("/library");
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit wave
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardContent>
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Wave number</span>
            <Input name="waveNumber" type="number" min={1} defaultValue={waveNumber} className="w-28" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Month</span>
            <Input name="month" type="number" min={1} max={12} defaultValue={month} className="w-24" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Year</span>
            <Input name="year" type="number" min={2000} max={2100} defaultValue={year} className="w-28" />
          </label>
          <label className="min-w-56 flex-1 text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Key events (semicolon separated)</span>
            <Input name="keyEvents" defaultValue={keyEvents.join("; ")} />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              disabled={busy || documentCount > 0}
              title={documentCount > 0 ? "Delete this wave's documents first" : "Delete this empty wave"}
              className="ml-auto text-destructive"
            >
              Delete wave
            </Button>
          )}
        </form>
        {documentCount > 0 && canDelete && (
          <p className="mt-2 text-xs text-muted-foreground">
            This wave has {documentCount} document(s) — delete those individually before the wave can be removed.
          </p>
        )}
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
