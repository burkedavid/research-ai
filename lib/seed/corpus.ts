/**
 * Synthetic seed corpus (§B10.1). Entirely fictional consumers — safe for
 * dev/preview environments (§A13.1: no live client data outside production).
 *
 * Every planted quote below is unique in the corpus so the golden-question
 * suite (§B10.3) can assert exact retrieval and verbatim reproduction.
 */

export const FRESCO_SEGMENTS = [
  { name: "Rising Metropolitans", description: "Younger urban professionals, higher incomes, digitally confident" },
  { name: "Budgeting Elderly", description: "Retired, fixed incomes, careful planners, value-focused" },
  { name: "Stretched Families", description: "Working parents, squeezed by childcare and housing costs" },
  { name: "Comfortable Traditionalists", description: "Older, mortgage-free, savings-backed, change-averse" },
  { name: "Young Strivers", description: "Early-career renters, ambitious, financially precarious" },
  { name: "Prudent Professionals", description: "Mid-career, risk-aware, strong savers, pension-focused" },
] as const;

export const THEMES = [
  "Cost of living and inflation",
  "Energy and fuel",
  "Food shopping",
  "Savings, debt and budgeting",
  "Banks and financial services",
  "Pensions and retirement",
  "Digital banking and technology",
  "AI and automation",
  "Trust, fairness and confidence",
  "Optimism, anxiety and resilience",
  "NHS and public services",
  "Politics, elections and government policy",
  "Work and employment",
  "Housing",
  "Holidays and discretionary spending",
  "Christmas and seasonal pressures",
] as const;

export interface CorpusTurn {
  moderator: string;
  consumer: string;
}

export interface CorpusInterview {
  externalRef: string;
  segment: (typeof FRESCO_SEGMENTS)[number]["name"];
  age: number;
  gender: string;
  region: string;
  turns: CorpusTurn[];
}

export interface CorpusReportSection {
  heading: string;
  paragraphs: string[];
}

export interface CorpusWave {
  waveNumber: number;
  month: number;
  year: number;
  label: string;
  keyEvents: string[];
  interviews: CorpusInterview[];
  report: { title: string; sections: CorpusReportSection[] };
}

type SegmentName = (typeof FRESCO_SEGMENTS)[number]["name"];

const SEG_CODE: Record<SegmentName, string> = {
  "Rising Metropolitans": "RM",
  "Budgeting Elderly": "BE",
  "Stretched Families": "SF",
  "Comfortable Traditionalists": "CT",
  "Young Strivers": "YS",
  "Prudent Professionals": "PP",
};

const DEMOGRAPHICS: Record<SegmentName, { age: number; gender: string; region: string }> = {
  "Rising Metropolitans": { age: 34, gender: "Female", region: "London" },
  "Budgeting Elderly": { age: 72, gender: "Male", region: "Midlands" },
  "Stretched Families": { age: 41, gender: "Female", region: "North West" },
  "Comfortable Traditionalists": { age: 63, gender: "Male", region: "South East" },
  "Young Strivers": { age: 26, gender: "Male", region: "Yorkshire" },
  "Prudent Professionals": { age: 48, gender: "Female", region: "Scotland" },
};

interface WaveVoice {
  mood: Record<SegmentName, string>;
  money: Record<SegmentName, string>;
  energy: Record<SegmentName, string>;
  food: Record<SegmentName, string>;
  banks: Record<SegmentName, string>;
  outlook: Record<SegmentName, string>;
  cuttingBack: Record<SegmentName, string>;
}

// ---------------------------------------------------------------------------
// Wave 1 — March 2020 (Covid onset)
// ---------------------------------------------------------------------------
const W2020: WaveVoice = {
  mood: {
    "Rising Metropolitans":
      "Honestly I am cautiously optimistic even with the lockdown starting. My work has moved online without much fuss and I keep telling friends this could be a reset we all needed.",
    "Budgeting Elderly":
      "It is unsettling. We have lived through hard times before, but being told to stay indoors at our age makes you feel the world has shrunk overnight.",
    "Stretched Families":
      "It is chaos. The school closed on Friday and I am supposed to work from the kitchen table while teaching fractions. I am anxious about the next few months.",
    "Comfortable Traditionalists":
      "We are calm about it. We have savings, the mortgage is long paid, and frankly we have seen panics come and go. This too shall pass.",
    "Young Strivers":
      "I am worried about my job more than the virus. Hospitality shifts vanished overnight and my flatmates are in the same boat.",
    "Prudent Professionals":
      "Concerned but organised. I rebuilt our household budget the day the lockdown was announced and moved three months of expenses into instant access.",
  },
  money: {
    "Rising Metropolitans":
      "My salary is safe for now, and weirdly I am spending less with no commute and no restaurants. The money worry is more about how long this lasts.",
    "Budgeting Elderly":
      "The pension does not change, so in a strange way we are steadier than the young ones. But prices in the local shop have already crept up.",
    "Stretched Families":
      "My husband's hours were cut the first week. We sat down with the bills and worked out what could wait. It is frightening how little slack there is.",
    "Comfortable Traditionalists":
      "No real change for us financially. The savings rates are dreadful, of course, but we are not touching the capital.",
    "Young Strivers":
      "I have maybe two weeks of savings. If the furlough thing does not come through I genuinely do not know what I will do about rent.",
    "Prudent Professionals":
      "We have stress-tested the budget. My worry is the pension pot — watching the markets drop twenty percent in a fortnight was sobering.",
  },
  energy: {
    "Rising Metropolitans":
      "Being home all day the heating is on more, but honestly energy is not something I think about much yet.",
    "Budgeting Elderly":
      "We have always been careful with the heating. Jumpers first, thermostat second — that is how we were raised.",
    "Stretched Families":
      "The bills will go up with everyone home all day, that has crossed my mind. Kids leave every light in the house on.",
    "Comfortable Traditionalists":
      "The oil tank is full and we fixed our tariff last year, so no concerns there for now.",
    "Young Strivers":
      "Our flat is freezing anyway. The landlord will not fix the boiler properly so we just wear coats indoors half the winter.",
    "Prudent Professionals":
      "I fixed our energy tariff for two years in January, which now looks like good timing.",
  },
  food: {
    "Rising Metropolitans":
      "The panic buying is absurd. I could not get pasta or flour anywhere last week. I have started ordering a veg box instead.",
    "Budgeting Elderly":
      "The supermarket shelves being empty shook me. We now go at the early hour for older people and the staff have been kind.",
    "Stretched Families":
      "Feeding four people three meals a day at home is expensive. I am meal planning properly for the first time in years.",
    "Comfortable Traditionalists":
      "We stocked the freezer sensibly, no hoarding. The local butcher delivers now which is rather good.",
    "Young Strivers":
      "Lots of beans on toast. I am not proud of it but the big shop is where I can actually control spending.",
    "Prudent Professionals":
      "We batch cook on Sundays now. Waste has dropped to almost nothing, which pleases me more than it should.",
  },
  banks: {
    "Rising Metropolitans":
      "The banking app does everything I need. I have not set foot in a branch in two years and this will not change that.",
    "Budgeting Elderly":
      "The bank rang me to check I was okay and whether I needed help getting cash, which genuinely surprised me. Good marks for that.",
    "Stretched Families":
      "We asked about a mortgage holiday and the bank was actually helpful, sorted it in one call. Credit where it is due.",
    "Comfortable Traditionalists":
      "Banks are functional, nothing more. As long as they do not close our local branch we will rub along fine.",
    "Young Strivers":
      "My overdraft charges got frozen which helps. I bank entirely on my phone, the high street means nothing to me.",
    "Prudent Professionals":
      "I watch the banks closely. They behaved badly in 2008; the early signs this time are that they are being told to behave better.",
  },
  outlook: {
    "Rising Metropolitans":
      "Optimistic overall. Give it six months and I think we come out of this with better habits, more remote working, more appreciation for what matters.",
    "Budgeting Elderly":
      "We take each week as it comes. At our age you learn not to look too far ahead, but I do worry for the grandchildren's jobs.",
    "Stretched Families":
      "I cannot think past the summer. If schools stay shut and the hours stay cut, things get very tight very fast.",
    "Comfortable Traditionalists":
      "The country will muddle through, it always does. We are more worried about the social cost than the financial one.",
    "Young Strivers":
      "Hopeful but nervous. My generation keeps getting told to wait our turn and this feels like another setback.",
    "Prudent Professionals":
      "Cautious. I expect a hard year and I have planned for a hard year. Anything better is a bonus.",
  },
  cuttingBack: {
    "Rising Metropolitans":
      "Cutting back has happened by accident — no commute, no coffees, no gym. I am saving two hundred pounds a month without trying.",
    "Budgeting Elderly":
      "We have always run a careful house. There is not much left to cut back on when you already shop with a list and a calculator.",
    "Stretched Families":
      "We are cutting back on everything that is not essential. The streaming services went first, then the takeaways.",
    "Comfortable Traditionalists":
      "The cruise we had booked for May is cancelled, so the cutting back is being done for us, in a way.",
    "Young Strivers":
      "I have cut back to the bone already. Nights out are gone, the gym is gone, I even switched my phone to a ten pound sim.",
    "Prudent Professionals":
      "We trimmed subscriptions and paused the holiday fund. Sensible cutting back now beats painful cuts later.",
  },
};

// ---------------------------------------------------------------------------
// Wave 32 — October 2022 (energy crisis, inflation peak)
// ---------------------------------------------------------------------------
const W2022: WaveVoice = {
  mood: {
    "Rising Metropolitans":
      "The optimism of the pandemic recovery has drained away. Everything costs more, the news is grim, and even people with decent salaries are muttering.",
    "Budgeting Elderly":
      "Frightened, if I am honest. This winter scares me more than Covid did. The numbers on the energy letters do not seem real.",
    "Stretched Families":
      "Exhausted. Every single bill has gone up and my wages have not. There is a constant background hum of worry now.",
    "Comfortable Traditionalists":
      "Irritated more than worried. The country lurches from one crisis to the next and nobody seems to be steering.",
    "Young Strivers":
      "Angry, honestly. Rent up, energy up, food up, and my pay rise was three percent. The maths simply does not work.",
    "Prudent Professionals":
      "Braced. We saw inflation coming and prepared, but the scale of the energy rises caught even me off guard.",
  },
  money: {
    "Rising Metropolitans":
      "I am fine but I have stopped feeling comfortable. The mortgage fix ends next year and the rates being talked about are eye-watering.",
    "Budgeting Elderly":
      "The pension rise was swallowed whole by the electric. We are spending our small savings on ordinary living, which was never the plan.",
    "Stretched Families":
      "We are overdrawn by the twentieth of every month. I have started a spreadsheet of every penny and it still does not balance.",
    "Comfortable Traditionalists":
      "Our savings are finally earning interest again, which is the one silver lining of all this misery.",
    "Young Strivers":
      "Saving for a deposit feels like a joke now. Everything I put aside gets eaten by the next bill. I have stopped even looking at house prices.",
    "Prudent Professionals":
      "We are absorbing it, but I have pushed my pension contributions down for the first time ever to keep monthly cash free. That decision hurt.",
  },
  energy: {
    "Rising Metropolitans":
      "My direct debit went from ninety pounds to two hundred and forty. I have a smart meter now and I check it like a stock ticker.",
    "Budgeting Elderly":
      "We have started keeping the heating off until the grandchildren visit. I sit with a blanket and a hot water bottle most evenings.",
    "Stretched Families":
      "We only heat the front room now. The kids do homework in there together and the bedroom doors stay shut. It feels like going backwards fifty years.",
    "Comfortable Traditionalists":
      "The oil price doubled. We can pay it, but paying it makes me furious. Someone is profiteering and it is not being stopped.",
    "Young Strivers":
      "Our landlord put the rent up and the energy is on top. I shower at the gym to save the hot water, no exaggeration.",
    "Prudent Professionals":
      "My two-year fix ended in August and the new quote was treble. I have spreadsheets comparing every tariff and none of them are good.",
  },
  food: {
    "Rising Metropolitans":
      "My weekly shop went from sixty to ninety pounds for the same basket. I have switched to the discounter for basics and I am not ashamed of it.",
    "Budgeting Elderly":
      "I walk to three shops now to get the best price on each thing. Butter is a luxury item, which I never thought I would say.",
    "Stretched Families":
      "Yellow sticker shopping at seven in the evening, that is us now. The kids notice the brands changing and I hate that they notice.",
    "Comfortable Traditionalists":
      "The waste has stopped, I will say that. We use everything now, leftovers into soup, the lot, like my mother did.",
    "Young Strivers":
      "I eat at my mum's twice a week to make the food budget stretch. Twenty-six years old and back to Sunday dinners for survival.",
    "Prudent Professionals":
      "We meal plan to the pound now. The supermarket own brands have won me over on most things, honestly.",
  },
  banks: {
    "Rising Metropolitans":
      "The banks are quick enough to raise mortgage rates and very slow to raise savings rates. Everyone can see the game being played.",
    "Budgeting Elderly":
      "They closed our branch in the spring. The nearest one is two bus rides away now. For people like us that is not service, it is abandonment.",
    "Stretched Families":
      "I rang about extending the overdraft and it was all chatbots and waiting. When you are desperate, forty minutes on hold feels like contempt.",
    "Comfortable Traditionalists":
      "Trust in banks? Low and falling. The savings rate lag is naked profiteering and the regulator watches it happen.",
    "Young Strivers":
      "The app is fine, the fees are not. Charged twice for going over by literal pennies. They know exactly who they are squeezing.",
    "Prudent Professionals":
      "I moved our savings twice this year chasing honest rates. Loyalty is punished in banking, that is the clear lesson of 2022.",
  },
  outlook: {
    "Rising Metropolitans":
      "Pessimistic for the first time in my adult life. I do not see what turns this around inside two years.",
    "Budgeting Elderly":
      "We just want to get through this winter. I do not let myself think further than March.",
    "Stretched Families":
      "Something has to give. Either prices come down or wages go up, because families like ours cannot run on empty forever.",
    "Comfortable Traditionalists":
      "The country needs a plan and grown-ups in charge. Until then, batten down the hatches.",
    "Young Strivers":
      "Bleak. Everyone my age talks about leaving — different city, different country, anywhere the rent is not a ransom.",
    "Prudent Professionals":
      "A hard eighteen months, then slow repair. I am planning on that basis and hoping to be wrong.",
  },
  cuttingBack: {
    "Rising Metropolitans":
      "We are cutting back properly now — the second car went, the gym is cancelled, holidays are domestic. Middle-class thrift is suddenly everywhere.",
    "Budgeting Elderly":
      "Cutting back on heating and food at the same time, at our age, in this country, in this century. I find it shameful, truly.",
    "Stretched Families":
      "There is nothing left to cut back. When people say tighten your belt I want to show them the belt. We are past trimming, we are into skipping.",
    "Comfortable Traditionalists":
      "We have cut back on principle more than necessity. Fewer meals out, one less trip. It feels wrong to carry on as normal while neighbours struggle.",
    "Young Strivers":
      "Cut back? I have cut everything. My one luxury left is a streaming account I split four ways with my flatmates.",
    "Prudent Professionals":
      "We cut back early and deliberately — Christmas budget halved, big purchases deferred. Control the cuts before they control you.",
  },
};

// ---------------------------------------------------------------------------
// Wave 76 — June 2026 (slow recovery, AI anxiety, pre-election mood)
// ---------------------------------------------------------------------------
const W2026: WaveVoice = {
  mood: {
    "Rising Metropolitans":
      "Guardedly positive again. Prices have settled, my salary caught up a bit, and the constant crisis feeling has faded. I would call it optimism with scar tissue.",
    "Budgeting Elderly":
      "Steadier than a few years ago. We survived the worst of the bills, though the habits it taught us have stuck — the blanket is still on the sofa.",
    "Stretched Families":
      "Better, cautiously. We cleared the overdraft in January and I nearly cried. But one bad month would put us straight back, and I never forget that.",
    "Comfortable Traditionalists":
      "Content enough, though the world feels less predictable than the one we retired into. You hold your plans more loosely now.",
    "Young Strivers":
      "Mixed. Work is going well and I finally got a proper pay rise, but the housing ladder still feels greased. Hope and frustration in equal measure.",
    "Prudent Professionals":
      "Quietly confident. The emergency fund is rebuilt, the pension contributions are back up, and I have stopped checking prices with dread.",
  },
  money: {
    "Rising Metropolitans":
      "Comfortable again, but I spend differently now — more deliberately. The casual swiping of 2019 never came back and I doubt it ever will.",
    "Budgeting Elderly":
      "We manage. The pension rises helped and prices stopped galloping. We even booked a coach holiday, our first proper treat in four years.",
    "Stretched Families":
      "Month to month still, but the months balance now. We started putting twenty pounds a week into savings, which sounds small but feels enormous.",
    "Comfortable Traditionalists":
      "Solid. The savings interest is decent, we have helped both children with house deposits, and there is enough left for the garden and the golf.",
    "Young Strivers":
      "Saving properly for the first time. Two hundred a month into a lifetime ISA. The deposit is still years away but at least the line on the chart goes up.",
    "Prudent Professionals":
      "Recovered and rebalanced. I restored the pension contributions I cut in 2022 and added a bit extra to make up the lost ground.",
  },
  energy: {
    "Rising Metropolitans":
      "The bills are liveable now but I kept the smart meter habit. Once you have watched your money burn by the kilowatt hour you do not unsee it.",
    "Budgeting Elderly":
      "Prices came down but our habits did not change back. Heating goes on for visitors and cold snaps, and that is how it will stay.",
    "Stretched Families":
      "Normal-ish bills at last. We still only heat the rooms we use — turns out half the things the crisis forced on us were just sense.",
    "Comfortable Traditionalists":
      "We put solar panels on last summer, mostly out of spite at the energy companies. Best decision in years, the export payments are a small pleasure.",
    "Young Strivers":
      "New flat has decent insulation, which I now ask about before I ask about the kitchen. Priorities have permanently changed.",
    "Prudent Professionals":
      "On a sensible fix and the house is now properly insulated. The crisis cost us thousands but it forced upgrades we should have done anyway.",
  },
  food: {
    "Rising Metropolitans":
      "The discounter habit stuck for basics, but the farmers market is back for weekends. A strange two-tier shopping life, and I quite like it.",
    "Budgeting Elderly":
      "Prices are steadier. I still shop with the list and check every receipt, and butter is back in the basket, I am pleased to report.",
    "Stretched Families":
      "The kids get the branded cereal again, which tells you everything. Still careful, still meal planning, but the shame shopping is over.",
    "Comfortable Traditionalists":
      "We spend a little more freely on food now, quality over quantity. The soup-from-leftovers habit stayed because it is simply better.",
    "Young Strivers":
      "I actually cook properly now — the crisis taught me. My food spend is half what my takeaway habit cost in 2021 and I eat better.",
    "Prudent Professionals":
      "Stable. The meal planning never stopped, it just got less anxious. I know our food budget to the pound and it holds every month.",
  },
  banks: {
    "Rising Metropolitans":
      "My bank is basically an app with an AI assistant now, and it is genuinely good — it spotted a duplicate subscription I had missed for a year.",
    "Budgeting Elderly":
      "The banking hub in town is a lifeline since the branches went. A real person, a real counter. Whoever thought of it deserves a medal.",
    "Stretched Families":
      "Banks feel less hostile than in 2022, I will admit. The budgeting tools in the app actually helped us clear the overdraft.",
    "Comfortable Traditionalists":
      "Trust is partially repaired, no more. The rates are honest now, but we remember the profiteering and so should everyone.",
    "Young Strivers":
      "All app, all the time. The AI chat sorted a disputed payment in minutes. My generation will never queue in a branch and never miss it.",
    "Prudent Professionals":
      "Rates are fair, tools are good, but I keep my deliberate scepticism. Banks are fair-weather friends — the last fifteen years proved it twice.",
  },
  outlook: {
    "Rising Metropolitans":
      "Genuinely hopeful for the first time since before the energy crisis. Not the naive optimism of 2020 — an earned, careful sort of confidence.",
    "Budgeting Elderly":
      "We plan again, which is the biggest change. A holiday booked, presents budgeted. When you stop just surviving, that is when you notice you were.",
    "Stretched Families":
      "Hopeful, whisper it. If the next couple of years stay calm we might actually get ahead instead of just catching up.",
    "Comfortable Traditionalists":
      "Steady as she goes. The election will bring its usual circus, but our plans no longer hinge on politicians behaving sensibly.",
    "Young Strivers":
      "More hopeful than I was, less than I should be. The AI thing at work worries me more than money now — half my job could be automated inside five years.",
    "Prudent Professionals":
      "Confident but watchful. We are one global surprise away from another squeeze, and unlike 2020, everybody knows it now.",
  },
  cuttingBack: {
    "Rising Metropolitans":
      "The cutting back era is over for us, but the deliberateness stayed. I still audit the subscriptions every January like a ritual.",
    "Budgeting Elderly":
      "Less cutting back, more careful choosing. There is a difference, and after the last few years we have earned the right to the nicer biscuits.",
    "Stretched Families":
      "We still cut back by habit, but now the savings go into the rainy day pot instead of straight onto bills. Same behaviour, completely different feeling.",
    "Comfortable Traditionalists":
      "We loosened the belt this year — the kitchen is finally being done. Four years deferred, and the relief of just saying yes was remarkable.",
    "Young Strivers":
      "Still frugal, now by choice. The crisis broke my impulse spending for good, which might be the only thing I thank it for.",
    "Prudent Professionals":
      "The disciplined budget stays forever now. Cutting back stopped being an emergency measure and became simply how we run the house.",
  },
};

const MOD_QUESTIONS = {
  mood: "To start us off, how would you describe your general mood at the moment — how are you feeling about things?",
  money: "And thinking specifically about money and your household finances, how are things for you right now?",
  energy: "What about energy — gas, electricity, fuel. How is that affecting you at the moment?",
  food: "Tell me about food shopping. Has anything changed in how you shop or what you buy?",
  banks: "How do you feel about banks and financial services these days? Any recent experiences, good or bad?",
  outlook: "Looking ahead over the next year or so, how do you feel about the future?",
  cuttingBack: "Have you cut back on anything recently, or changed your spending in any way?",
} as const;

function buildInterviews(voice: WaveVoice, waveTag: string): CorpusInterview[] {
  return FRESCO_SEGMENTS.map((seg) => {
    const demo = DEMOGRAPHICS[seg.name];
    return {
      externalRef: `${SEG_CODE[seg.name]}_${demo.gender[0]}_${waveTag}`,
      segment: seg.name,
      age: demo.age,
      gender: demo.gender,
      region: demo.region,
      turns: (Object.keys(MOD_QUESTIONS) as (keyof typeof MOD_QUESTIONS)[]).map((topic) => ({
        moderator: MOD_QUESTIONS[topic],
        consumer: voice[topic][seg.name],
      })),
    };
  });
}

function summarise(voice: WaveVoice, topic: keyof WaveVoice): string[] {
  const names = FRESCO_SEGMENTS.map((s) => s.name);
  return [
    `Across the sample there were clear differences by segment. ${names[0]} said: "${voice[topic][names[0]].split(". ")[0]}." while ${names[1]} reported: "${voice[topic][names[1]].split(". ")[0]}."`,
    `Several consumers in the ${names[2]} and ${names[4]} segments described similar pressures, though a few voices — notably among ${names[3]} — struck a more sanguine note. These differences should be read as indicative rather than representative given the qualitative sample.`,
  ];
}

function buildReport(voice: WaveVoice, label: string, contextPara: string): CorpusWave["report"] {
  return {
    title: `Consumer Sentiment Findings — ${label}`,
    sections: [
      {
        heading: "Executive summary",
        paragraphs: [
          contextPara,
          "This report summarises qualitative findings from six depth interviews, one per Fresco segment. Findings are indicative and grounded in verbatim evidence; small-base caveats apply throughout.",
        ],
      },
      { heading: "Mood and confidence", paragraphs: summarise(voice, "mood") },
      { heading: "Cost of living", paragraphs: summarise(voice, "money") },
      { heading: "Energy and fuel", paragraphs: summarise(voice, "energy") },
      { heading: "Food shopping", paragraphs: summarise(voice, "food") },
      { heading: "Banks and financial services", paragraphs: summarise(voice, "banks") },
      { heading: "Future outlook", paragraphs: summarise(voice, "outlook") },
    ],
  };
}

export const CORPUS_WAVES: CorpusWave[] = [
  {
    waveNumber: 1,
    month: 3,
    year: 2020,
    label: "March 2020",
    keyEvents: ["Covid-19 pandemic onset", "First UK national lockdown announced"],
    interviews: buildInterviews(W2020, "03_2020"),
    report: buildReport(
      W2020,
      "March 2020",
      "Fieldwork coincided with the announcement of the first national lockdown. Consumer mood was dominated by uncertainty about Covid-19, with sharp differences between financially cushioned and precarious segments.",
    ),
  },
  {
    waveNumber: 32,
    month: 10,
    year: 2022,
    label: "October 2022",
    keyEvents: ["Energy price crisis", "Inflation above 10%", "Political instability"],
    interviews: buildInterviews(W2022, "10_2022"),
    report: buildReport(
      W2022,
      "October 2022",
      "Fieldwork took place at the height of the energy crisis, with inflation above ten percent. Energy costs dominated every interview, and trust in institutions — particularly banks and government — was at its lowest point in the archive.",
    ),
  },
  {
    waveNumber: 76,
    month: 6,
    year: 2026,
    label: "June 2026",
    keyEvents: ["Inflation normalised", "AI adoption in services", "Pre-election period"],
    interviews: buildInterviews(W2026, "06_2026"),
    report: buildReport(
      W2026,
      "June 2026",
      "Fieldwork found a recovering but permanently changed consumer. Crisis-era habits — meal planning, energy vigilance, deliberate spending — have persisted into better times, and a cautious, earned optimism has replaced both the naive confidence of 2020 and the despair of 2022.",
    ),
  },
];

/** Render an interview as the plain-text transcript format the parser ingests. */
export function renderTranscript(interview: CorpusInterview): string {
  const header = [
    `Interview: ${interview.externalRef}`,
    `Segment: ${interview.segment}`,
    `Demographics: ${interview.gender}, ${interview.age}, ${interview.region}`,
    "",
  ].join("\n");
  const body = interview.turns.map((t) => `MOD: ${t.moderator}\n\nR: ${t.consumer}`).join("\n\n");
  return `${header}\n${body}\n`;
}
