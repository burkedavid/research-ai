import Link from "next/link";
import { notFound } from "next/navigation";
import { CsvExportButton } from "@/components/csv-export-button";
import { ThemeTimeline } from "@/components/theme-timeline";
import { WordCloud } from "@/components/word-cloud";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSegmentProfile } from "@/lib/services/segments";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SegmentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const profile = await getSegmentProfile(user, id);
  if (!profile) notFound();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/segments" className="text-sm text-slate-500 underline">
        ← Segments
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-brand-900">{profile.segment.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{profile.segment.description}</p>
      <p className="mt-2 text-sm">
        <Link href={`/ask`} className="text-slate-700 underline">
          Ask the Archive about this segment →
        </Link>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-brand-900">Recurring themes</CardTitle>
            {profile.themeFrequencies.length > 0 && (
              <CsvExportButton
                filename={`themes-${profile.segment.name.toLowerCase().replace(/\s+/g, "-")}`}
                headers={["Theme", "Passages", "Interviews"]}
                rows={profile.themeFrequencies.map((t) => [t.themeName, t.chunkCount, t.interviewCount])}
              />
            )}
          </CardHeader>
          <CardContent>
            {profile.themeFrequencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No indexed evidence for this segment yet.</p>
            ) : (
              <ul className="space-y-2">
                {profile.themeFrequencies.map((t) => (
                  <li key={t.themeName} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{t.themeName}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t.chunkCount} passage{t.chunkCount === 1 ? "" : "s"}
                      {t.interviewCount > 0 && ` · ${t.interviewCount} interview${t.interviewCount === 1 ? "" : "s"}`}
                      {t.interviewCount > 0 && t.interviewCount < 3 && (
                        <Badge className="border-amber-200 bg-amber-100 text-amber-800">small base</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Counts describe discussion volume in a qualitative sample, not statistical prevalence.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-brand-900">Consumer language</CardTitle>
          </CardHeader>
          <CardContent>
            <WordCloud words={profile.words} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-brand-900">Theme frequency over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeTimeline points={profile.timeline} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-brand-900">Recent verbatim</CardTitle>
          </CardHeader>
          <CardContent>
            {!user.transcriptAccess ? (
              <p className="text-sm text-amber-800">Verbatim requires transcript access.</p>
            ) : profile.verbatim.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transcript evidence indexed for this segment yet.</p>
            ) : (
              <div className="space-y-3">
                {profile.verbatim.map((v) => (
                  <blockquote key={v.chunkId} className="border-l-2 border-brand-200 pl-3">
                    <p className="text-sm text-slate-800">“{v.quote}”</p>
                    <footer className="mt-1 text-xs text-muted-foreground">
                      {v.interviewRef ?? "consumer"} · {v.wave} ·{" "}
                      <a href={`/library/documents/${v.documentId}?chunk=${v.chunkId}`} target="_blank" className="underline">
                        source
                      </a>
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
