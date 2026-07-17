"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmWaveButton({ waveId, disabled }: { waveId: string; disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/waves/${waveId}/confirm`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not confirm wave");
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <Button
        type="button"
        onClick={confirm}
        disabled={disabled || busy}
        title={disabled ? "All documents must be reviewed and indexed first" : undefined}
        className="bg-green-700 text-white hover:bg-green-600"
      >
        {busy ? "Confirming…" : "Confirm wave"}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
