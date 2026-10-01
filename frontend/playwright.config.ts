import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  reporter: process.env.CI
    ? [["line"], ["junit", { outputFile: "test-results/e2e-junit.xml" }]]
    : "list",
  use: {
    // localhost, not 127.0.0.1: the API is called at localhost:8080, and the
    // SameSite=Strict session cookie is only sent between pages of the same site.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
