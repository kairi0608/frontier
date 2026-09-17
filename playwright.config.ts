import { defineConfig, devices } from "@playwright/test";
import { getAppMode } from "./lib/config/app-mode";
const mode = getAppMode();
const port = mode === "production" ? 3112 : 3111;
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: mode === "production" ? "production.spec.ts" : "workflow.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
