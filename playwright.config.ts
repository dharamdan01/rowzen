import { defineConfig, devices, type Project } from "@playwright/test";

// Use the exact same hostname for login, stored cookies, and the test server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const authState = process.env.PLAYWRIGHT_AUTH_STATE?.trim();

const projects: Project[] = [
  {
    name: "public-chromium",
    testMatch: "**/*.public.spec.ts",
    use: { ...devices["Desktop Chrome"] },
  },
];

// Authenticated tests are opt-in. Never manufacture a session or bypass Better Auth.
// Save a REAL login in an external temporary file and point this variable to it.
if (authState) {
  projects.push({
    name: "authenticated-chromium",
    testMatch: "**/*.auth.spec.ts",
    use: { ...devices["Desktop Chrome"], storageState: authState },
  });
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    acceptDownloads: true,
  },
  projects,
  webServer: process.env.PLAYWRIGHT_USE_EXISTING_SERVER === "1"
    ? undefined
    : {
        command: "npm run dev",
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
