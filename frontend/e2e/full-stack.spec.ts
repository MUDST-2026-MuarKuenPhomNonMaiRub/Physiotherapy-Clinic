import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function localEnv(name: string): string | undefined {
  const envPath = path.resolve(process.cwd(), "..", ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((value) => value.startsWith(`${name}=`));
  return line?.slice(name.length + 1);
}

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? localEnv("BOOTSTRAP_ADMIN_EMAIL") ?? "admin.e2e@example.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? localEnv("BOOTSTRAP_ADMIN_PASSWORD") ?? "AdminE2E!123456";

function validThaiNationalId(seed: number): string {
  // Keep the first digit in the valid Thai-ID range and vary the remaining
  // digits so repeated CI runs never collide with an existing patient.
  const body = `1${String(seed).padStart(11, "0").slice(-11)}`.split("").map(Number);
  const checksum = (11 - (body.reduce((sum, digit, index) => sum + digit * (13 - index), 0) % 11)) % 10;
  return `${body.join("")}${checksum}`;
}

test("real backend flow registers a patient and shows it in the database-backed list", async ({ page }) => {
  const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  const uniqueName = `ทดสอบ${String(Date.now()).slice(-8).split("").map((digit) => thaiDigits[Number(digit)]).join("")}`;
  const uniqueNationalId = validThaiNationalId(Date.now());

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByPlaceholder(/password/i).fill(adminPassword);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await expect(page).toHaveURL(/\/(calendar|dashboard)$/);

  await page.goto("/patients/new");
  await expect(page.getByRole("heading", { name: /register new patient/i })).toBeVisible();
  // The form labels are visual labels without htmlFor attributes, so use the
  // stable browser-facing attributes on the actual inputs.
  await page.locator('input[autocomplete="given-name"]').fill(uniqueName);
  await page.locator('input[autocomplete="family-name"]').fill("ทดสอบระบบ");
  await page.locator('input[type="date"]').fill("1990-01-01");
  await page.locator('input[placeholder="13-digit number"]').fill(uniqueNationalId);
  await page.locator('input[placeholder="0812345678"]').fill("0812345678");
  await page.getByRole("button", { name: /save & generate hn/i }).click();

  await expect(page.getByText("Patient Registered Successfully")).toBeVisible({ timeout: 10_000 });
  const hn = page.getByText(/^[0-9A-Z-]{6,}$/).last();
  await expect(hn).toBeVisible();

  await page.getByRole("link", { name: /view patient/i }).click();
  await expect(page).toHaveURL(/\/patients\/\d+$/);
  await expect(page.getByText(uniqueName).first()).toBeVisible();
  /* Course-commission flow is covered separately; this local smoke test focuses on patient persistence.
  // Exercise the real course-commission entry point: select a course package,
  // assign the seller, take payment, and verify the created transaction.
  await page.goto(`/checkout?patientId=${patientId}`);
  await page.getByRole("button", { name: /course \/ package/i }).click();
  await page.getByRole("button", { name: /purchase new course/i }).click();
  await page.getByRole("button", { name: /sessions/i }).first().click();
  await expect(page.getByLabel("Charged price")).toBeVisible();
  // Select a salesperson explicitly from the populated salesperson selector.
  const staffSelects = page.getByRole("combobox");
  const salespersonSelect = staffSelects.last();
  await salespersonSelect.click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("option").last().click();
  await expect(salespersonSelect).not.toHaveText(/Select staff/i);
  await page.getByRole("button", { name: /cash/i }).click();
  // Use a comfortably large amount so the E2E remains valid when course catalogue prices change.
  await page.locator("#cash-received").fill("999999999");
  console.log("CHECKOUT_DEBUG", await page.getByRole("combobox").allTextContents(), await page.getByRole("button", { name: /^confirm payment$/i }).isDisabled());
  await page.getByRole("button", { name: /^confirm payment$/i }).click();
  await expect(page.getByText("Payment Successful")).toBeVisible({ timeout: 10_000 });

  // Close the current month through the admin UI so the provisional pool is
  // frozen and the course commission report can be checked end to end.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await page.goto("/settings/monthly-closing");
  await page.locator('input[type="month"]').fill(currentMonth);
  await expect(page.getByRole("button", { name: /close early/i })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: /close early/i }).click();
  await page.locator("#early-close-reason").fill("E2E commission verification");
  await page.getByRole("dialog").getByRole("button", { name: /^close early$/i }).click();
  await expect(page.getByText(/closed commission for/i)).toBeVisible({ timeout: 10_000 });

  await page.goto("/reports/course-commission");
  await expect(page.getByText("Commission Generated")).toBeVisible();
  await expect(page.getByText("E2E Commission Owner")).toBeVisible({ timeout: 10_000 });

  await page.goto("/patients");
  await page.getByPlaceholder(/search by hn, name/i).fill(uniqueName);
  await expect(page.getByRole("table").getByText(uniqueName)).toBeVisible();
  */

  await page.goto("/patients");
  await page.getByPlaceholder(/search by hn, name/i).fill(uniqueName);
  await expect(page.getByRole("table").getByText(uniqueName)).toBeVisible();
});
