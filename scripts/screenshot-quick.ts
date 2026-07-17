import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/** Quick two-page font/branding check: login + home. */
const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "screens-quick";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { timeout: 120_000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT, "login.png") });

  await page.getByLabel(/Email/).fill("researcher@example.com");
  await page.getByLabel(/Password/).fill("dev-password");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 120_000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT, "home.png") });

  await browser.close();
  console.log("QUICK_DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
