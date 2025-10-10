/**
 * Example E2E test with Playwright
 */

import { test, expect } from "@playwright/test";

test("homepage loads correctly", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/ImgGo/);
  await expect(page.getByText("Turn images into strictly schema-conformant")).toBeVisible();
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/_health");
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(data).toHaveProperty("status");
  expect(data).toHaveProperty("services");
});
