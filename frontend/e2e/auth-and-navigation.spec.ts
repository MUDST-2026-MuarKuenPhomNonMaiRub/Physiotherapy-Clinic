import { test, expect } from "@playwright/test";

test("invalid login shows a safe error and does not enter the app", async ({ page }) => {
  await page.route("**/api/v1/auth/login", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Invalid credentials" }) }));
  await page.goto("/login");
  await page.getByLabel("Email").fill("not-a-user@example.com");
  await page.getByPlaceholder(/password/i).fill("WrongPassword!123");
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/invalid|unable|credentials/i).first()).toBeVisible();
});

test("protected direct navigation redirects unauthenticated users", async ({ page }) => {
  await page.goto("/settings/staff-access");
  await expect(page).toHaveURL(/\/login$/);
});
