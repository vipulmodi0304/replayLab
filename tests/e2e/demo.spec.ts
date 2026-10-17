import { test, expect } from "@playwright/test";

// Browser smoke test: a new account gets the demo project, the replay catches
// the schema regression, and accepting it makes the next replay pass.
test("run the demo replay, review the regression, and accept it", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Smoke Test");
  await page.getByLabel("Email", { exact: true }).fill(`smoke-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo Commerce API" })).toBeVisible();

  await page.getByRole("button", { name: "Run replay", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Replay complete" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("link", { name: /Get User/ }).first().click();
  await expect(page.getByRole("heading", { name: "Get User", exact: true })).toBeVisible();
  await expect(page.getByText("profile.age", { exact: true })).toBeVisible();
  await expect(page.getByText("email", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /Response diff/ }).click();
  await expect(page.getByText("Response body")).toBeVisible();

  await page.getByRole("button", { name: "Accept as new baseline" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Accept as new baseline" }).click();
  await expect(page.getByText(/Accepted by Smoke Test/)).toBeVisible();
});
