import { defineConfig } from "@playwright/test";

// Engine tests are pure and need no server. End-to-end tests need the app and a
// seeded database: set E2E_BASE_URL to an already running stack, or let
// Playwright start `npm run dev` (DATABASE_URL must point at Postgres).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const e2e = process.argv.some((a) => a.includes("e2e"));

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL, viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
  webServer: e2e && !process.env.E2E_BASE_URL ? { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120000 } : undefined,
  reporter: "list",
});
