"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Create / copy / revoke a public read-only share link for a saved output (F3). */
export function ShareControls({ id, initialToken }: { id: string; initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${token}` : null;

  async function share() {
    setBusy(true);
    const res = await fetch(`/api/saved-outputs/${id}/share`, { method: "POST" });
    setBusy(false);
    if (res.ok) setToken((await res.json()).token);
  }
  async function revoke() {
    setBusy(true);
    const res = await fetch(`/api/saved-outputs/${id}/share`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) setToken(null);
  }

  if (!token) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={share} disabled={busy}>
        {busy ? "…" : "Share link"}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <input
        readOnly
        value={url ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-border bg-brand-50 px-2 py-1 text-xs text-slate-700"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => {
          if (url) navigator.clipboard.writeText(url);
        }}
      >
        Copy
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={revoke} disabled={busy}>
        Revoke
      </Button>
    </div>
  );
}
