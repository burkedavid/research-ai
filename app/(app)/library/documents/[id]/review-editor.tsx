"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SentimentBadge } from "@/components/sentiment-badge";

interface ChunkView {
  id: string;
  seq: number;
  content: string;
  speakerRole: string;
  evidenceType: string;
  sentiment: string | null;
  sectionPath: string | null;
  pageRef: string | null;
  segmentId: string | null;
  interviewId: string | null;
  piiSuggestions: { text: string; kind: string }[];
  themes: { themeId: string; name: string; source: string; confidence: number | null }[];
  embedded: boolean;
}

interface Props {
  documentId: string;
  highlightChunkId?: string | null;
  documentStatus: string;
  canEdit: boolean;
  canApprove: boolean;
  chunks: ChunkView[];
  segments: { id: string; name: string }[];
  themes: { id: string; name: string; definition?: string | null }[];
  interviews: { id: string; ref: string }[];
}

export function ReviewEditor({ documentId, highlightChunkId, documentStatus, canEdit, canApprove, chunks, segments, themes, interviews }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(chunks);

  useEffect(() => {
    if (highlightChunkId) {
      document.getElementById(`chunk-${highlightChunkId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightChunkId]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function patchLocal(id: string, patch: Partial<ChunkView>) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function save(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/chunks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return false;
    }
    return true;
  }

  async function redact(chunk: ChunkView, span: { text: string; kind: string }) {
    const redacted = chunk.content.split(span.text).join(`[REDACTED ${span.kind.toUpperCase()}]`);
    const remaining = chunk.piiSuggestions.filter((p) => p.text !== span.text);
    const ok = await save(chunk.id, {
      content: redacted,
      ...(remaining.length === 0 ? { clearPiiSuggestions: true } : {}),
    });
    if (ok) patchLocal(chunk.id, { content: redacted, piiSuggestions: remaining });
  }

  async function dismissPii(chunk: ChunkView) {
    const ok = await save(chunk.id, { clearPiiSuggestions: true });
    if (ok) patchLocal(chunk.id, { piiSuggestions: [] });
  }

  async function toggleTheme(chunk: ChunkView, themeId: string, name: string) {
    const has = chunk.themes.some((t) => t.themeId === themeId);
    const next = has
      ? chunk.themes.filter((t) => t.themeId !== themeId)
      : [...chunk.themes, { themeId, name, source: "human", confidence: null }];
    const ok = await save(chunk.id, { themeIds: next.map((t) => t.themeId) });
    if (ok) patchLocal(chunk.id, { themes: next.map((t) => ({ ...t, source: "human", confidence: null })) });
  }

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const reason = action === "reject" ? (prompt("Reason for rejection?") ?? "") : undefined;
    if (action === "reject" && !reason) {
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/documents/${documentId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason }) : JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `${action} failed`);
      return;
    }
    router.refresh();
  }

  const totalPii = items.reduce((n, c) => n + c.piiSuggestions.length, 0);
  const aiSuggestedCount = items.reduce(
    (n, c) => n + c.themes.filter((t) => t.source === "ai_suggested").length,
    0,
  );

  async function acceptSuggestions() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/accept-suggestions`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not accept suggestions");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-medium text-brand-900">
          {documentStatus === "review" ? "Review the extracted passages" : "Extracted passages"} ({items.length})
          {totalPii > 0 && <Badge variant="destructive">{totalPii} possible personal detail(s) to resolve</Badge>}
        </h2>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {aiSuggestedCount > 0 && (
              <Button type="button" variant="outline" onClick={acceptSuggestions} disabled={busy}>
                Accept AI tags ({aiSuggestedCount})
              </Button>
            )}
            {canApprove && documentStatus === "review" && (
              <>
                <Button type="button" variant="destructive" onClick={() => decide("reject")} disabled={busy}>
                  Reject
                </Button>
                <Button type="button" onClick={() => decide("approve")} disabled={busy}>
                  {busy ? "Working…" : "Approve & index"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {documentStatus === "review" && canEdit && (
        <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-sm text-slate-700">
          <p className="font-medium text-brand-900">What to do here</p>
          <p className="mt-1">
            Nothing in this document is searchable until you approve it. Read each passage against the original
            (<strong>Open original</strong>, top right) and check four things:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <strong>The text extracted cleanly</strong> — no missing or garbled passages. Edit the text if the parser
              got it wrong.
            </li>
            <li>
              <strong>The labels are right</strong> — who is speaking, whether it is consumer voice or researcher
              interpretation, and which segment or interview it belongs to.
            </li>
            <li>
              <strong>Themes are correct</strong> — a filled-in chip is tagged, a plain one is not. Click to toggle.
              Themes the AI suggested are marked, and <strong>Accept AI tags</strong> confirms them all at once.
            </li>
            <li>
              <strong>Any personal details are dealt with</strong> — redact or dismiss each flagged span. Redacting
              changes the searchable text; the original file is never altered.
            </li>
          </ol>
          <p className="mt-2">
            Then choose <strong>Approve &amp; index</strong> to make it searchable, or <strong>Reject</strong> if the
            document should not be used.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-medium text-brand-900">Theme chips:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-brand-800 px-2 py-0.5 text-white">tagged</span> confirmed by a reviewer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">tagged</span> suggested by the AI,
              not yet confirmed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-400">not tagged</span> click
              to add
            </span>
          </p>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {items.map((chunk) => (
          <Card
            key={chunk.id}
            id={`chunk-${chunk.id}`}
            className={chunk.id === highlightChunkId ? "ring-2 ring-blue-400" : undefined}
          >
            <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">#{chunk.seq}</span>
              {chunk.sectionPath && <span>· {chunk.sectionPath}</span>}
              {chunk.pageRef && <span>· {chunk.pageRef}</span>}
              <SentimentBadge sentiment={chunk.sentiment} />
              {chunk.embedded && <Badge className="border-green-200 bg-green-100 text-green-800">indexed</Badge>}
            </div>

            {canEdit ? (
              <Textarea
                defaultValue={chunk.content}
                rows={Math.min(12, Math.max(3, chunk.content.split("\n").length + 1))}
                onBlur={async (e) => {
                  if (e.target.value !== chunk.content) {
                    const ok = await save(chunk.id, { content: e.target.value });
                    if (ok) patchLocal(chunk.id, { content: e.target.value });
                  }
                }}
                className="mt-2 text-sm leading-6"
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{chunk.content}</p>
            )}

            {chunk.piiSuggestions.length > 0 && canEdit && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-800">Possible personal data — redact or dismiss:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {chunk.piiSuggestions.map((span, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => redact(chunk, span)}
                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                      title="Replace with a redaction marker"
                    >
                      {span.kind}: “{span.text}” — redact
                    </button>
                  ))}
                  <button type="button" onClick={() => dismissPii(chunk)} className="text-xs text-slate-500 underline">
                    dismiss all
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <label>
                Who is speaking{" "}
                <select
                  disabled={!canEdit}
                  defaultValue={chunk.speakerRole}
                  onChange={async (e) => {
                    const ok = await save(chunk.id, { speakerRole: e.target.value });
                    if (ok) patchLocal(chunk.id, { speakerRole: e.target.value });
                  }}
                  className="rounded border border-slate-300 px-1 py-0.5"
                >
                  {["moderator", "consumer", "mixed", "n/a"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Evidence type{" "}
                <select
                  disabled={!canEdit}
                  defaultValue={chunk.evidenceType}
                  onChange={async (e) => {
                    const ok = await save(chunk.id, { evidenceType: e.target.value });
                    if (ok) patchLocal(chunk.id, { evidenceType: e.target.value });
                  }}
                  className="rounded border border-slate-300 px-1 py-0.5"
                >
                  {["direct_quote", "researcher_summary", "guide", "context"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Segment{" "}
                <select
                  disabled={!canEdit}
                  defaultValue={chunk.segmentId ?? ""}
                  onChange={async (e) => {
                    const value = e.target.value || null;
                    const ok = await save(chunk.id, { segmentId: value });
                    if (ok) patchLocal(chunk.id, { segmentId: value });
                  }}
                  className="rounded border border-slate-300 px-1 py-0.5"
                >
                  <option value="">—</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Interview{" "}
                <select
                  disabled={!canEdit}
                  defaultValue={chunk.interviewId ?? ""}
                  onChange={async (e) => {
                    const value = e.target.value || null;
                    const ok = await save(chunk.id, { interviewId: value });
                    if (ok) patchLocal(chunk.id, { interviewId: value });
                  }}
                  className="rounded border border-slate-300 px-1 py-0.5"
                >
                  <option value="">—</option>
                  {interviews.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.ref}
                    </option>
                  ))}
                </select>
              </label>
              {savingId === chunk.id && <span className="text-slate-400">saving…</span>}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {themes.map((t) => {
                const tag = chunk.themes.find((ct) => ct.themeId === t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleTheme(chunk, t.id, t.name)}
                    className={
                      tag
                        ? tag.source === "human"
                          ? "rounded-full bg-brand-800 px-2 py-0.5 text-xs text-white"
                          : "rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                        : "rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-400 hover:border-slate-400"
                    }
                    title={[
                      // the definition is what tells a reviewer whether this
                      // theme actually fits the passage
                      t.definition?.trim() ? `${t.name}: ${t.definition.trim()}` : t.name,
                      tag
                        ? tag.source === "human"
                          ? "Confirmed by a reviewer"
                          : `AI-suggested (confidence ${tag.confidence?.toFixed(2) ?? "?"}) — click to keep as human tag, click again to remove`
                        : "Click to add this theme",
                    ].join("\n\n")}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
