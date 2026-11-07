import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:43123",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: ".venv/bin/uvicorn cuadra.api.app:app --host 127.0.0.1 --port 43124",
      cwd: "../backend",
      url: "http://127.0.0.1:43124/api/salud",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 43123",
      cwd: "../frontend",
      url: "http://127.0.0.1:43123",
      reuseExistingServer: true,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
