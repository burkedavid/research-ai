import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/** Logs in and screenshots every major page against the dev server (:3000).
 *  Usage: npx tsx scripts/screenshot-tour.ts <output-dir> */
const BASE = process.env.TOUR_BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "screens";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await shot("01-login");

  await page.getByLabel(/Email/).fill("researcher@example.com");
  await page.getByLabel(/Password/).fill("dev-password");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await shot("02-home");

  await page.goto(`${BASE}/ask`);
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder(/Rising Metropolitans/).fill("How have consumers talked about energy bills since 2020?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.getByText("Sources", { exact: true }).waitFor({ timeout: 60_000 });
  await shot("03-ask");

  await page.goto(`${BASE}/quotes`);
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder(/cutting back/).fill("cutting back");
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForTimeout(3000);
  await shot("04-quotes");

  await page.goto(`${BASE}/library`);
  await page.waitForLoadState("networkidle");
  await shot("05-library");

  await page.getByRole("link", { name: /Wave 76/ }).click();
  await page.waitForLoadState("networkidle");
  await shot("06-wave");

  await page.getByRole("link", { name: /transcript-.*\.txt/ }).first().click();
  await page.waitForLoadState("networkidle");
  await shot("07-document-review");

  await page.goto(`${BASE}/segments`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /Rising Metropolitans/ }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await shot("08-segment");

  await page.goto(`${BASE}/compare`);
  await page.waitForLoadState("networkidle");
  await shot("09-compare");

  await page.goto(`${BASE}/reports`);
  await page.waitForLoadState("networkidle");
  await shot("10-reports");

  await page.goto(`${BASE}/help`);
  await page.waitForLoadState("networkidle");
  await shot("11-help");

  // admin needs the admin user
  await page.goto(`${BASE}/api/auth/signout`);
  await page.getByRole("button").first().click().catch(() => {});
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email/).fill("admin@example.com");
  await page.getByLabel(/Password/).fill("dev-password");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60_000 });
  await page.goto(`${BASE}/admin`);
  await page.waitForLoadState("networkidle");
  await shot("12-admin");

  await browser.close();
  console.log(`TOUR_DONE ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
