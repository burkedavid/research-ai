import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Runs under tsx (spawned by e2e/global-setup.ts) so tsconfig path aliases
 * resolve: reset + migrate + seed the test DB, ingest the synthetic corpus,
 * and write fixture files for the upload journey.
 */
async function main() {
  const { resetTestDatabase } = await import("../tests/setup/global-setup");
  await resetTestDatabase();

  const { ensureCorpusIngested } = await import("../tests/helpers");
  await ensureCorpusIngested();

  const { CORPUS_WAVES, renderTranscript } = await import("../lib/seed/corpus");
  const { buildReportDocx } = await import("../lib/seed/build-files");
  const dir = path.join(process.cwd(), ".e2e-fixtures");
  await mkdir(dir, { recursive: true });

  const base = CORPUS_WAVES[2].interviews[0];
  const julyInterview = {
    ...base,
    externalRef: "RM_F_07_2026",
    turns: base.turns.map((t, i) =>
      i === 0
        ? {
            ...t,
            consumer:
              "July feels steadier still. The summer has been kind to our budget and honestly the mood in the office has lifted with it.",
          }
        : t,
    ),
  };
  await writeFile(path.join(dir, "transcript-RM_F_07_2026.txt"), renderTranscript(julyInterview));

  const julyReport = {
    ...CORPUS_WAVES[2],
    report: {
      title: "Consumer Sentiment Findings — July 2026",
      sections: [
        {
          heading: "Executive summary",
          paragraphs: [
            "Fieldwork in July 2026 found consumer mood continuing its cautious recovery, with several consumers describing steadier household finances.",
            "This report summarises qualitative findings; small-base caveats apply throughout.",
          ],
        },
        ...CORPUS_WAVES[2].report.sections.slice(1, 3),
      ],
    },
  };
  await writeFile(path.join(dir, "report-2026-07.docx"), await buildReportDocx(julyReport));

  console.log("E2E_DB_SETUP_DONE");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
