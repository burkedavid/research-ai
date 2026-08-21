"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface AskSuggestionRow {
  category: string;
  question: string;
}

export interface SuggestionSettings {
  ask: { override: AskSuggestionRow[] | null; derived: AskSuggestionRow[] };
  quotes: { override: string[] | null; derived: string[] };
}

const MAX_ITEMS = 12;

/**
 * Editor for the starter questions on Ask the Archive and the starter searches
 * on Find Quotes.
 *
 * Both lists are generated from whatever is actually indexed, so they stay
 * truthful as the archive grows. This panel exists for the cases the data
 * cannot know about — house phrasing, a client's vocabulary, a question the
 * team wants everyone to start from.
 */
export function SuggestionsPanel({ settings }: { settings: SuggestionSettings }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ask, setAsk] = useState<AskSuggestionRow[]>(settings.ask.override ?? settings.ask.derived);
  const [quotes, setQuotes] = useState<string[]>(settings.quotes.override ?? settings.quotes.derived);

  async function save(kind: "ask" | "quotes", items: unknown | null) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, items }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-6">
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            These are the examples new users see before they have typed anything. By default they are built from the
            themes and waves that are actually indexed, so they always return results. Edit them here to use your own
            wording; reset to go back to the generated list.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ---------------- Ask the Archive ---------------- */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-brand-900">Suggested questions</h3>
              <p className="text-xs text-muted-foreground">
                Shown as cards on Ask the Archive.{" "}
                {settings.ask.override ? "Currently using your custom list." : "Currently generated from the archive."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => save("ask", ask)}>
                Save questions
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !settings.ask.override}
                onClick={() => {
                  setAsk(settings.ask.derived);
                  void save("ask", null);
                }}
              >
                Reset to generated
              </Button>
            </div>
          </div>

          <ul className="space-y-2">
            {ask.map((row, i) => (
              <li key={i} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label={`Label for suggestion ${i + 1}`}
                  placeholder="Label, e.g. Energy"
                  className="sm:w-52"
                  value={row.category}
                  onChange={(e) =>
                    setAsk(ask.map((r, j) => (j === i ? { ...r, category: e.target.value } : r)))
                  }
                />
                <Input
                  aria-label={`Question ${i + 1}`}
                  placeholder="Question a researcher might ask"
                  value={row.question}
                  onChange={(e) =>
                    setAsk(ask.map((r, j) => (j === i ? { ...r, question: e.target.value } : r)))
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove suggestion ${i + 1}`}
                  onClick={() => setAsk(ask.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="outline"
            disabled={ask.length >= MAX_ITEMS}
            onClick={() => setAsk([...ask, { category: "", question: "" }])}
          >
            Add question
          </Button>

          {settings.ask.override && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">What the archive would suggest on its own</summary>
              <ul className="mt-1 list-disc pl-5">
                {settings.ask.derived.map((d, i) => (
                  <li key={i}>
                    <span className="font-medium">{d.category}</span> — {d.question}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Find Quotes ---------------- */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-brand-900">Suggested quote searches</h3>
              <p className="text-xs text-muted-foreground">
                Shown as chips on Find Quotes.{" "}
                {settings.quotes.override
                  ? "Currently using your custom list."
                  : "Currently generated from the archive."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => save("quotes", quotes)}>
                Save searches
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !settings.quotes.override}
                onClick={() => {
                  setQuotes(settings.quotes.derived);
                  void save("quotes", null);
                }}
              >
                Reset to generated
              </Button>
            </div>
          </div>

          <ul className="space-y-2">
            {quotes.map((q, i) => (
              <li key={i} className="flex gap-2">
                <Input
                  aria-label={`Search ${i + 1}`}
                  placeholder="A phrase consumers actually use"
                  value={q}
                  onChange={(e) => setQuotes(quotes.map((v, j) => (j === i ? e.target.value : v)))}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove search ${i + 1}`}
                  onClick={() => setQuotes(quotes.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="outline"
            disabled={quotes.length >= MAX_ITEMS}
            onClick={() => setQuotes([...quotes, ""])}
          >
            Add search
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
