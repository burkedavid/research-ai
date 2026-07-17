import path from "node:path";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/**
 * The full monthly wave journey (§A7.1, §B10.4): create wave → upload →
 * review → approve → confirm → what-changed report → edit → export .docx.
 */
test.describe.serial("monthly wave journey", () => {
  test("researcher uploads, reviews and confirms a new wave without developer support", async ({ page }) => {
    await login(page, "researcher@example.com");

    // 1. create the July 2026 wave
    await page.goto("/library");
    await page.getByRole("button", { name: "New wave" }).click();
    await page.locator('input[name="waveNumber"]').fill("77");
    await page.locator('input[name="month"]').fill("7");
    await page.locator('input[name="year"]').fill("2026");
    await page.locator('input[name="keyEvents"]').fill("Summer heatwave; Interest rate cut");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("link", { name: "Wave 77" })).toBeVisible();

    // 2. upload a transcript
    await page.getByRole("link", { name: "Wave 77" }).click();
    await page.getByLabel("Source type").selectOption("transcript");
    await page.getByLabel("Files").setInputFiles(path.join(process.cwd(), ".e2e-fixtures", "transcript-RM_F_07_2026.txt"));
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("link", { name: "transcript-RM_F_07_2026.txt" })).toBeVisible({ timeout: 60_000 });

    // 3. upload the report
    await page.getByLabel("Source type").selectOption("report");
    await page.getByLabel("Files").setInputFiles(path.join(process.cwd(), ".e2e-fixtures", "report-2026-07.docx"));
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("link", { name: "report-2026-07.docx" })).toBeVisible({ timeout: 60_000 });

    // 4. review the transcript: suggested metadata visible, then approve
    await page.getByRole("link", { name: "transcript-RM_F_07_2026.txt" }).click();
    await expect(page.getByText(/Extracted chunks/)).toBeVisible();
    await expect(page.locator("textarea").first()).toBeVisible();
    await page.getByRole("button", { name: "Approve & index" }).click();
    await expect(page.getByText("status: indexed")).toBeVisible({ timeout: 60_000 });

    // 5. review + approve the report
    await page.goBack();
    await page.getByRole("link", { name: "report-2026-07.docx" }).click();
    await page.getByRole("button", { name: "Approve & index" }).click();
    await expect(page.getByText("status: indexed")).toBeVisible({ timeout: 60_000 });

    // 6. confirm the wave
    await page.goBack();
    await page.getByRole("button", { name: "Confirm wave" }).click();
    await expect(page.getByText("confirmed")).toBeVisible({ timeout: 30_000 });
  });

  test("what-changed report generates from the new wave, is editable and exports to Word", async ({ page }) => {
    await login(page, "researcher@example.com");
    await page.goto("/reports");

    await page.locator("select").first().selectOption("what_changed");
    await page.locator("select").nth(1).selectOption({ label: "Wave 77 — 2026-07" });
    await page.getByRole("button", { name: "Generate draft" }).click();

    // title and section headings render as editable inputs — assert values
    await expect(page.getByRole("textbox").first()).toHaveValue(/What has changed — July 2026/, {
      timeout: 120_000,
    });
    await expect(page.getByRole("textbox").nth(1)).toHaveValue(/vs previous wave/i);

    // edit a section before export (human-editable drafts, §A9)
    const textarea = page.locator("textarea").first();
    await textarea.fill("EDITED BY RESEARCHER: several consumers appeared steadier this month [A1].");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export to Word" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/What-has-changed.*\.docx/);
  });

  test("ask the archive returns a cited, caveated answer about the new wave", async ({ page }) => {
    await login(page, "researcher@example.com");
    await page.goto("/ask");

    await page.getByPlaceholder(/Rising Metropolitans/).fill("How do consumers feel about their household finances this summer?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();

    // evidential basis banner + streamed answer + sources list
    // (banner statements end with a colon — "High confidence:", "Treat with
    // caution:" — which distinguishes them from the sidebar theme labels)
    await expect(page.getByText(/(confidence|caution):/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Sources", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Why these results/)).toBeVisible();
  });
});
