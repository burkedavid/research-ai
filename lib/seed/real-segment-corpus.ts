import { Document, Packer, Paragraph, TextRun } from "docx";
import { REAL_SEGMENTS, REGIONS } from "@/lib/seed/segments";

/**
 * Report-shaped demo content covering the TWELVE real Fresco segments, in the
 * same format as the client's actual reports: bold section headings, prose,
 * then verbatim quotes attributed inline as "(Segment, Region)".
 *
 * The synthetic corpus in lib/seed/corpus.ts deliberately keeps its own six
 * invented segments — the golden-question tests assert planted quotes in it —
 * so this is additive: it populates the Segment Observatory for the real
 * taxonomy without touching the test fixtures.
 */

interface Section {
  heading: string;
  intro: string;
  /** one quote per segment index, cycled */
  quotes: string[];
}

const SECTIONS: Section[] = [
  {
    heading: "Life in the UK",
    intro:
      "Consumers continue to separate how they feel about their own lives from how they feel about the country. Personal circumstances are described in steadier terms, while the national picture draws words like uncertain, unsettled and unpredictable.",
    quotes: [
      "Life at home is fine, but everything you read about the country feels unsettled and I try not to dwell on it.",
      "I feel like I am getting somewhere personally, even though the news makes it hard to feel confident about the country.",
      "Work is going well and that colours everything, but I would not say I feel optimistic about the UK as a whole.",
      "Between the kids and the bills there is not much room to think about the country, we just get through the week.",
      "Things are steady for us, though I notice I have stopped expecting anything to actually improve nationally.",
      "We are comfortable enough, but the mood around us feels flat and people seem worn down by it all.",
      "Personally I have no complaints, professionally things are strong, but the wider picture feels directionless.",
      "We are settled, the mortgage is manageable, yet there is a sense the country is drifting rather than moving.",
      "Renting at my age was not the plan, and it makes the wider uncertainty feel a lot more personal.",
      "We are fortunate, no mortgage and some savings, so the uncertainty affects our mood more than our money.",
      "I am counting down to retiring and mostly hoping nothing changes before I get there.",
      "At my age you have seen it all before, but the prices still catch you out every single week.",
    ],
  },
  {
    heading: "Cost of living and household finances",
    intro:
      "Everyday costs remain the dominant pressure. Food and energy are the most visible, and consumers describe adjusting habits rather than making dramatic changes. Several note that spending more to stand still has become normal.",
    quotes: [
      "I hand over money at home now, which I never used to, and that has changed how I think about spending.",
      "Rent takes most of it and saving anything meaningful feels out of reach at the moment.",
      "I earn well but the outgoings have crept up so much that it does not feel like it any more.",
      "Childcare and food are the two that hurt, and there is nothing left to cut back on that is not essential.",
      "We are careful, we shop differently, and honestly we spend more now for exactly the same basket.",
      "The mortgage went up and the weekly shop went up, so the holiday is the thing that quietly disappeared.",
      "We are fine financially, but I have become far more deliberate about where the money actually goes.",
      "The children cost more every year and wages have not kept anything like the same pace.",
      "Rent rises are the thing I dread, because there is no fixed rate to protect you from them.",
      "Our costs are covered by savings and a pension, so it is more irritation than genuine worry.",
      "I am watching the pension pot closely because I want to know it will stretch when I stop working.",
      "Every week the same shop costs a bit more, and on a fixed income you feel each increase.",
    ],
  },
  {
    heading: "Energy, fuel and the weekly shop",
    intro:
      "Energy bills feel less acute than at the peak, but standing charges and the coming winter remain a concern. Food prices are the most frequently mentioned pressure, with switching to cheaper ranges now routine.",
    quotes: [
      "I do not pay the bills directly, but I hear about them constantly so I do notice.",
      "I keep the heating off far more than I would like and just put another layer on.",
      "I have kept the smart meter habits even though the bills are more manageable now.",
      "We buy the value ranges as standard now, the children barely notice and it saves a real amount.",
      "Filling the car is the one that still stings, and I plan journeys around it more than I used to.",
      "We batch cook far more, mostly to avoid the mid-week top-up shops that add up so quickly.",
      "The bills are not a problem for us, but I still find the increases genuinely annoying on principle.",
      "Feeding teenagers is its own economy, and the shop has gone up more than anything else we buy.",
      "Heating a rented place badly insulated is expensive and I cannot do anything about the insulation.",
      "We can absorb it, but I do think about the people on our street who plainly cannot.",
      "We are trying to get the house efficient before retirement so the bills are predictable later.",
      "I shop the reductions and go later in the day, which I never used to have to do.",
    ],
  },
  {
    heading: "Outlook and confidence",
    intro:
      "Looking ahead, consumers are cautiously balanced: more positive about their own next six months than about the country's. Where optimism appears it is grounded in personal plans rather than national conditions.",
    quotes: [
      "I am hopeful because I am moving out next year, which feels like real progress.",
      "If I can keep saving at this rate then next year should genuinely look different for me.",
      "Career-wise I am optimistic, and that is enough to carry the rest of it.",
      "I just want a year where nothing unexpected breaks or needs replacing.",
      "We have a holiday booked, which is the first proper thing to look forward to in a while.",
      "As long as the mortgage stays where it is, we will be alright and I can plan again.",
      "I am confident personally, though I would not describe myself as confident about the country.",
      "The children leaving education soon changes our finances, so I am cautiously positive.",
      "I would like to think renting will not be forever, but I am not counting on it.",
      "We are secure, so my worry is more for our children than for ourselves.",
      "Retirement is close and I feel mostly prepared, which is a relief after years of worrying.",
      "At this stage I just hope things stay steady and predictable, that would do me.",
    ],
  },
];

/** Build one report .docx in the client's real format for a given month. */
export async function buildRealSegmentReport(year: number, month: number): Promise<Buffer> {
  const monthName = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month];
  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: "Consumer Sentiment", bold: true, size: 32 })] }),
    new Paragraph({ children: [new TextRun(`Summary Report — fieldwork ${monthName} ${year}`)] }),
    new Paragraph({ children: [new TextRun({ text: "Background", bold: true })] }),
    new Paragraph({
      children: [
        new TextRun(
          `This report summarises qualitative interviews conducted in ${monthName} ${year} across the twelve consumer segments. Findings are indicative and grounded in verbatim evidence; small-base caveats apply throughout.`,
        ),
      ],
    }),
  ];

  for (const [sIdx, section] of SECTIONS.entries()) {
    children.push(new Paragraph({ children: [new TextRun({ text: section.heading, bold: true })] }));
    children.push(new Paragraph({ children: [new TextRun(section.intro)] }));
    // every segment contributes an attributed quote, so all twelve get evidence
    for (const [i, seg] of REAL_SEGMENTS.entries()) {
      const quote = section.quotes[i % section.quotes.length];
      const region = REGIONS[(i + sIdx) % REGIONS.length];
      children.push(new Paragraph({ children: [new TextRun(`“${quote}”`)] }));
      children.push(new Paragraph({ children: [new TextRun(`(${seg.name}, ${region})`)] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
