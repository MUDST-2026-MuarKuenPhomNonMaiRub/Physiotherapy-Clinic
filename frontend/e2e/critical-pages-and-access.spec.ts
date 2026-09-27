import { test, expect, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin.e2e@example.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E!123456";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByPlaceholder(/password/i).fill(adminPassword);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await expect(page).toHaveURL(/\/(calendar|dashboard)$/);
}

test.describe("critical browser access", () => {
  test("authenticated admin can open the operational screens", async ({ page }) => {
    await signIn(page);

    const screens = [
      ["/patients", /patients/i],
      ["/appointments", /appointments|visits/i],
      ["/checkout", /checkout/i],
      ["/courses", /course/i],
      ["/courses/transfer", /transfer/i],
      ["/transactions", /transactions/i],
      ["/reports/course-commission", /commission/i],
    ] as const;

    for (const [path, heading] of screens) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}(?:$|\\?)`));
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    }
  });

  test("authenticated admin can open every administration settings screen", async ({ page }) => {
    await signIn(page);

    const screens = [
      ["/settings/staff-access", /staff.*access/i],
      ["/settings/branches", /branches/i],
      ["/settings/commission-scheme", /commission.*tier|commission.*scheme/i],
      ["/settings/monthly-closing", /monthly.*closing/i],
      ["/settings/treatment-fee-rules", /treatment.*fee/i],
      ["/settings/services", /services/i],
      ["/settings/payment-methods", /payment/i],
    ] as const;

    for (const [path, heading] of screens) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}(?:$|\\?)`));
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    }
  });

  test("admin role management exposes configurable roles and permissions", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/staff-access");

    await expect(page.getByRole("button", { name: /manage roles.*permissions/i })).toBeVisible();
    await page.getByRole("button", { name: /manage roles.*permissions/i }).click();
    await expect(page.getByText(/roles.*permissions/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /new role/i })).toBeVisible();
  });

  test("direct navigation to an administration route requires authentication", async ({ page }) => {
    await page.goto("/settings/monthly-closing");
    await expect(page).toHaveURL(/\/login$/);
  });
});
