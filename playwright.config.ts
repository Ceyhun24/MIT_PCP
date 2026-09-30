// Browser tests (npm run test:e2e). They need the local test stack running
// (npm run db:dev — FAKE "TEST" data, see README) and use its keys, which are
// printed when it starts; put them in .env.local or the environment.
import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH; // optional: use an already installed Chromium

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : undefined,
    geolocation: { latitude: 40.379, longitude: 49.8485 },
    permissions: ["geolocation"],
  },
  projects: [
    { name: "mobile-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 780 }, isMobile: false } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
