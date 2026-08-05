import { test } from "@playwright/test";
import { login } from "./helpers";

/** Diagnostic: find page-level horizontal overflow across key pages at 375px. */
test("report horizontal overflow across pages at 375px", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "admin@example.com");
  await page.setViewportSize({ width: 375, height: 812 });

  const routes = ["/", "/library", "/admin", "/ask", "/trends", "/compare", "/reports", "/quotes", "/segments"];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);
    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offenders: { tag: string; cls: string; w: number; right: number; text: string }[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.width > vw + 1) {
          offenders.push({ tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 80), w: Math.round(r.width), right: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 30) });
        }
      }
      return { scrollWidth: document.documentElement.scrollWidth, offenders: offenders.slice(0, 6) };
    });
    // eslint-disable-next-line no-console
    console.log(`OVERFLOW ${route} scrollWidth=${report.scrollWidth} :: ${JSON.stringify(report.offenders)}`);
  }

  // also check a wave detail (its documents table is a known wide element)
  await page.goto("/library");
  const wave = page.locator('a[href^="/library/waves/"]').first();
  if (await wave.count()) {
    await wave.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
    // eslint-disable-next-line no-console
    console.log(`OVERFLOW /library/waves/[id] scrollWidth=${r.sw} vw=${r.vw}`);
  }
});
