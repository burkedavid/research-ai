import { chromium } from "@playwright/test";

/** Reproduce the /ask interactivity report: capture console errors, click an
 *  example pill, type into the input, click Ask, and report what happens. */
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 500));
  });
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${String(err).slice(0, 500)}`));

  await page.goto("http://localhost:3000/login", { timeout: 180_000 });
  await page.getByLabel(/Email/).fill("researcher@example.com");
  await page.getByLabel(/Password/).fill("dev-password");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 120_000 });

  await page.goto("http://localhost:3000/ask", { timeout: 180_000 });
  await page.waitForLoadState("networkidle");

  // 1. click an example pill
  await page.getByRole("button", { name: /energy crisis/ }).click();
  await page.waitForTimeout(4000);
  const askedViaPill = await page.getByText(/You:.*energy crisis/).count();
  console.log(`pill_click_started_answer=${askedViaPill > 0}`);

  // 2. type + Ask button
  const input = page.getByPlaceholder(/Rising Metropolitans/);
  await input.fill("How do consumers feel about food shopping?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.waitForTimeout(4000);
  const askedViaButton = await page.getByText(/You: How do consumers feel about food shopping\?/).count();
  console.log(`ask_button_started_answer=${askedViaButton > 0}`);

  // 3. filters: open a section, click a chip
  await page.getByRole("button", { name: /Segments/ }).click();
  await page.getByRole("button", { name: "Budgeting Elderly" }).click();
  await page.waitForTimeout(500);
  const chipActive = await page.locator('button[aria-pressed="true"]').count();
  console.log(`filter_chip_selected=${chipActive > 0}`);

  console.log(`console_errors=${errors.length}`);
  for (const e of errors.slice(0, 5)) console.log(`ERR: ${e}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
