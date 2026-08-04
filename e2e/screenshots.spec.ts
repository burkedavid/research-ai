import { test, type Page } from "@playwright/test";
import path from "node:path";
import { login } from "./helpers";

/**
 * Not an assertion test — captures full-page screenshots of every page at
 * desktop and mobile widths for a visual UI review. Run:
 *   npx playwright test e2e/screenshots.spec.ts
 */
const OUT = process.env.SHOTS_DIR ?? path.join(process.cwd(), ".ui-shots");
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function shoot(page: Page, name: string) {
  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.desktop.png`), fullPage: true });
  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.mobile.png`), fullPage: true });
  await page.setViewportSize(DESKTOP);
}

test("capture every page at desktop + mobile", async ({ page }) => {
  test.setTimeout(300_000);

  // login screen (pre-auth)
  await page.goto("/login");
  await page.waitForTimeout(500);
  await shoot(page, "01-login");

  await login(page, "admin@example.com");

  const routes: [string, string][] = [
    ["02-home", "/"],
    ["03-ask", "/ask"],
    ["04-compare", "/compare"],
    ["05-trends", "/trends"],
    ["06-segments", "/segments"],
    ["07-quotes", "/quotes"],
    ["08-reports", "/reports"],
    ["09-library", "/library"],
    ["10-outputs", "/library/outputs"],
    ["11-help", "/help"],
    ["12-admin", "/admin"],
  ];
  for (const [name, route] of routes) {
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    await shoot(page, name);
  }

  // detail pages — follow the first link where one exists
  await page.goto("/segments");
  const seg = page.locator('a[href^="/segments/"]').first();
  if (await seg.count()) {
    await seg.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await shoot(page, "13-segment-detail");
  }

  await page.goto("/library");
  const wave = page.locator('a[href^="/library/waves/"]').first();
  if (await wave.count()) {
    await wave.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await shoot(page, "14-wave-detail");
    const doc = page.locator('a[href^="/library/documents/"]').first();
    if (await doc.count()) {
      await doc.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await shoot(page, "15-document-detail");
    }
  }

  // a populated Ask answer (fake LLM streams a grounded, cited response)
  await page.goto("/ask");
  const askBox = page.getByPlaceholder(/Ask|question|cutting back/i).first();
  if (await askBox.count()) {
    await askBox.fill("How are consumers feeling about the cost of living?");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(4000);
    await shoot(page, "16-ask-answer");
  }
});
