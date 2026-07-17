import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/** Check the redesigned filter sidebar + brand mark on /ask. */
const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "screens-filters";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { timeout: 120_000 });
  await page.getByLabel(/Email/).fill("researcher@example.com");
  await page.getByLabel(/Password/).fill("dev-password");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 120_000 });

  await page.goto(`${BASE}/ask`);
  await page.waitForLoadState("networkidle");
  // open two sections and pick chips so the active-chip row shows
  await page.getByRole("button", { name: /Segments/ }).click();
  await page.getByRole("button", { name: "Rising Metropolitans" }).click();
  await page.getByRole("button", { name: /Themes/ }).click();
  await page.getByRole("button", { name: "Energy and fuel" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "ask-filters.png") });

  await page.goto(`${BASE}/login`).catch(() => {});
  await browser.close();
  console.log("FILTERS_DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
