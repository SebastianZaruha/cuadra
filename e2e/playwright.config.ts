import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:43123",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 43123",
    cwd: "../frontend",
    url: "http://127.0.0.1:43123",
    reuseExistingServer: false,
    env: { VITE_GA_ID: "G-CUADRATEST01" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
