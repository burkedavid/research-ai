import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

/** Phone + tablet viewport checks: home, ask, quotes, help, more-sheet. */
const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "screens-mobile";

async function run(name: string, viewport: { width: number; height: number }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, userAgent: devices["iPhone 13"].userAgent });
  const shot = (label: string) => page.screenshot({ path: path.join(OUT, `${name}-${label}.png`) });

  await page.goto(`${BASE}/login`, { timeout: 180_000 });
  await page.getByLabel(/Email/).fill("researcher@example.com");
  await page.getByLabel(/Password/).fill("dev-password");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 120_000 });
  await page.waitForLoadState("networkidle");
  await shot("home");

  await page.goto(`${BASE}/ask`);
  await page.waitForLoadState("networkidle");
  await shot("ask");

  await page.getByRole("button", { name: "More" }).click();
  await page.waitForTimeout(400);
  await shot("more-sheet");

  await page.goto(`${BASE}/quotes`);
  await page.waitForLoadState("networkidle");
  await shot("quotes");

  await browser.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await run("phone", { width: 390, height: 844 });
  await run("tablet", { width: 820, height: 1180 });
  console.log("MOBILE_DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
