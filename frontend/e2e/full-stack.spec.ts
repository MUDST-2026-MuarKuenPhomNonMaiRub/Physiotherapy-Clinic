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

  // Exercise the real course entry point and verify that the printable course
  // slip is reachable from the database-backed course row.
  const patientId = page.url().match(/\/patients\/(\d+)$/)?.[1];
  expect(patientId).toBeTruthy();
  await page.goto(`/checkout?patientId=${patientId}`);
  await page.getByRole("button", { name: /course \/ package/i }).click();
  await page.getByRole("button", { name: /purchase new course/i }).click();
  await page.getByRole("button", { name: /sessions/i }).first().click();
  await expect(page.getByLabel("Charged price")).toBeVisible();
  // Course purchase requires both a salesperson and at least one case owner.
  // Locate the triggers from their field labels, not their current text: a
  // logged-in staff account may legitimately preselect itself.
  const salespersonSelect = page.locator("label").filter({ hasText: "Salesperson" }).locator("..").getByRole("combobox");
  const caseOwnerSelect = page.locator("label").filter({ hasText: "Case Owners" }).locator("..").locator("..").getByRole("combobox").first();
  await expect(salespersonSelect).toBeVisible();
  await expect(caseOwnerSelect).toBeVisible();
  await salespersonSelect.click();
  const commissionOwnerOption = page.getByRole("option", { name: "E2E Commission Owner", exact: true });
  await expect(commissionOwnerOption).toBeVisible();
  await commissionOwnerOption.click();
  await caseOwnerSelect.click();
  await expect(commissionOwnerOption).toBeVisible();
  await commissionOwnerOption.click();
  await expect(salespersonSelect).not.toHaveText(/Select staff/i);
  await expect(caseOwnerSelect).not.toHaveText(/Owner 1/i);
  await page.getByRole("button", { name: /cash/i }).click();
  // Use a comfortably large amount so the E2E remains valid when course catalogue prices change.
  await page.locator("#cash-received").fill("999999999");
  await page.getByRole("button", { name: /^confirm payment$/i }).click();
  await expect(page.getByText("Payment Successful")).toBeVisible({ timeout: 10_000 });

  await page.goto("/courses");
  await page.getByPlaceholder(/search patient or hn/i).fill(uniqueName);
  await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("row").filter({ hasText: uniqueName }).click();
  await expect(page).toHaveURL(/\/courses\/\d+$/);
  await page.getByRole("link", { name: /พิมพ์ใบตัดคอร์ส/i }).click();
  await expect(page).toHaveURL(/\/courses\/\d+\/course-slip$/);
  await expect(page.getByRole("heading", { name: "ใบตัดคอร์สการรักษา" })).toBeVisible();

  const firstPageResponsePromise = page.waitForResponse((response) => {
    if (!response.ok() || !response.url().includes("/api/v1/patients/page")) return false;
    const params = new URL(response.url()).searchParams;
    return params.get("page") === "0" && params.get("size") === "25" && !params.has("search");
  });
  await page.goto("/patients");
  const firstPageResponse = await firstPageResponsePromise;
  const firstPageBody = await firstPageResponse.json();
  expect(firstPageBody.size).toBe(25);
  expect(firstPageBody.items.length).toBeLessThanOrEqual(25);

  const searchResponsePromise = page.waitForResponse((response) => {
    if (!response.ok() || !response.url().includes("/api/v1/patients/page")) return false;
    return new URL(response.url()).searchParams.get("search") === uniqueName;
  });
  await page.getByPlaceholder(/search by hn, name/i).fill(uniqueName);
  const searchResponse = await searchResponsePromise;
  const searchBody = await searchResponse.json();
  expect(searchBody.totalItems).toBe(1);
  expect(searchBody.items).toHaveLength(1);
  await expect(page.getByRole("table").getByText(uniqueName)).toBeVisible();

  const noResultResponsePromise = page.waitForResponse((response) => {
    if (!response.ok() || !response.url().includes("/api/v1/patients/page")) return false;
    return new URL(response.url()).searchParams.get("search") === "PATIENT_SEARCH_NO_MATCH_9F8C";
  });
  await page.getByPlaceholder(/search by hn, name/i).fill("PATIENT_SEARCH_NO_MATCH_9F8C");
  const noResultResponse = await noResultResponsePromise;
  const noResultBody = await noResultResponse.json();
  expect(noResultBody.totalItems).toBe(0);
  expect(noResultBody.items).toHaveLength(0);
  await expect(page.getByText("No patients found")).toBeVisible();

  const clearResponsePromise = page.waitForResponse((response) => {
    if (!response.ok() || !response.url().includes("/api/v1/patients/page")) return false;
    return !new URL(response.url()).searchParams.has("search");
  });
  await page.getByPlaceholder(/search by hn, name/i).fill("");
  const clearResponse = await clearResponsePromise;
  const clearBody = await clearResponse.json();
  expect(clearBody.page).toBe(0);
  expect(clearBody.size).toBe(25);
});
