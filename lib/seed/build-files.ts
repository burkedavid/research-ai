import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import type { CorpusWave } from "./corpus";

/** Render a corpus wave's report as a real .docx buffer (used by seed and tests). */
export async function buildReportDocx(wave: CorpusWave): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: wave.report.title, heading: HeadingLevel.HEADING_1 }),
  ];
  for (const section of wave.report.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }));
    for (const p of section.paragraphs) children.push(new Paragraph({ text: p }));
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
