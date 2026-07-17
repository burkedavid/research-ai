import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/** Browser-level permission boundaries (§B9.9, acceptance criterion 7). */

test("a viewer cannot reach admin functionality", async ({ page }) => {
  await login(page, "viewer@example.com");
  await page.goto("/admin");
  await expect(page.getByText(/requires the admin role/i)).toBeVisible();
  // no admin link in navigation either
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
});

test("a viewer sees no upload controls on a wave", async ({ page }) => {
  await login(page, "viewer@example.com");
  await page.goto("/library");
  await expect(page.getByRole("button", { name: "New wave" })).toHaveCount(0);
});

test("a user without transcript access cannot use the quote finder", async ({ page }) => {
  await login(page, "summary-only@example.com");
  await page.goto("/quotes");
  await expect(page.getByText(/cannot access/i)).toBeVisible();
});

test("a user without transcript access is blocked from transcript documents and files", async ({ page }) => {
  await login(page, "summary-only@example.com");

  // find a transcript document id via the wave page as an authorised user would —
  // instead we probe the API directly with this session's cookies
  const waves = await page.request.get("/api/waves");
  expect(waves.ok()).toBeTruthy();

  await page.goto("/library");
  const waveLink = page.getByRole("link", { name: /Wave 76/ });
  await waveLink.click();
  const transcriptLink = page.getByRole("link", { name: /transcript-.*\.txt/ }).first();
  const href = await transcriptLink.getAttribute("href");
  expect(href).toBeTruthy();

  // the review/document page refuses
  await page.goto(href!);
  await expect(page.getByText(/does not have transcript access/i)).toBeVisible();

  // and the raw file route refuses with 403
  const documentId = href!.split("/").pop();
  const fileResponse = await page.request.get(`/api/documents/${documentId}/file`);
  expect(fileResponse.status()).toBe(403);
});

test("an admin can see the audit log recording activity", async ({ page }) => {
  await login(page, "admin@example.com");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Audit log" }).click();
  await expect(page.getByText("login").first()).toBeVisible();
  await expect(page.getByText("upload").first()).toBeVisible();
  await expect(page.getByText("approve").first()).toBeVisible();
});
