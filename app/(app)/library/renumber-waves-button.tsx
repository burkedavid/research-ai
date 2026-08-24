"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Puts a project's wave numbers back into date order.
 *
 * Bulk upload numbers each wave by how many earlier waves existed when it was
 * created, so a back-catalogue loaded newest-first ends up with every wave
 * called "Wave 1". This is the fix, kept as a deliberate action because a real
 * archive's wave numbers can legitimately be non-sequential.
 */
export function RenumberWavesButton({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(projectId: string, projectName: string) {
    if (
      !confirm(
        `Renumber every wave in "${projectName}" as 1, 2, 3… in date order?\n\n` +
          "Use this if a bulk import left several waves with the same number. " +
          "If your wave numbers come from the real fieldwork series (e.g. Wave 32 of 76), do NOT renumber — " +
          "edit the numbers individually instead.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/waves/renumber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? "Could not renumber");
      return;
    }
    const { renumbered } = await res.json();
    setMsg(renumbered === 0 ? "Already in order — nothing changed." : `Renumbered ${renumbered} wave(s).`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {projects.map((p) => (
        <Button key={p.id} variant="outline" disabled={busy} onClick={() => run(p.id, p.name)}>
          {projects.length > 1 ? `Renumber waves — ${p.name}` : "Renumber waves by date"}
        </Button>
      ))}
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
