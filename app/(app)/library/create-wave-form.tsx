"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function CreateWaveForm({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/waves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: form.get("projectId"),
        waveNumber: Number(form.get("waveNumber")),
        month: Number(form.get("month")),
        year: Number(form.get("year")),
        keyEvents: String(form.get("keyEvents") ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create wave");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="mt-3">
        New wave
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="space-y-1">
        <Label htmlFor="wave-project" className="text-xs text-muted-foreground">
          Project
        </Label>
        <select id="wave-project" name="projectId" required className={selectClasses}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="wave-number" className="text-xs text-muted-foreground">
          Wave #
        </Label>
        <Input id="wave-number" name="waveNumber" type="number" min={1} required className="w-24" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="wave-month" className="text-xs text-muted-foreground">
          Month
        </Label>
        <Input id="wave-month" name="month" type="number" min={1} max={12} required className="w-20" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="wave-year" className="text-xs text-muted-foreground">
          Year
        </Label>
        <Input id="wave-year" name="year" type="number" min={2000} max={2100} required className="w-24" />
      </div>
      <div className="grow space-y-1">
        <Label htmlFor="wave-key-events" className="text-xs text-muted-foreground">
          Key events (separate with ;)
        </Label>
        <Input id="wave-key-events" name="keyEvents" type="text" placeholder="Energy crisis; Autumn Budget" />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create"}
      </Button>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
