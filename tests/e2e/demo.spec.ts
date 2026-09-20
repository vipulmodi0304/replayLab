import { test, expect } from "@playwright/test";
test("sign in, run the commerce replay, and inspect the schema regression", async ({
  page,
}) => {
  test.skip(
    !process.env.DEMO_PASSWORD,
    "Set DEMO_PASSWORD for the local seeded account.",
  );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("demo@replaylab.dev");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Commerce API" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run replay", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Replay complete" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("link", { name: "Get User", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Get User", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "profile.age", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "email", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /JSON diff/ }).click();
  await expect(
    page.getByText("Candidate response", { exact: true }),
  ).toBeVisible();
});
