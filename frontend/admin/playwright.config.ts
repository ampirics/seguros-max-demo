import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 240_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results/playwright',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.QA_PANEL_URL || 'http://localhost:3000',
    locale: 'es-DO',
    timezoneId: 'America/Santo_Domingo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
