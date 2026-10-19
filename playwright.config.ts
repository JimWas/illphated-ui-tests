import { defineConfig } from '@playwright/test';

import { resolveSessionTimeoutMs } from './utils/session.js';

function resolveDefaultTimeoutMs(): number {
  if (process.env.TEST_TIMEOUT_MS) return Number(process.env.TEST_TIMEOUT_MS);
  return process.env.SESSION_ENABLED === 'true' ? resolveSessionTimeoutMs() : 60_000;
}

export default defineConfig({
  testDir: './tests',
  timeout: resolveDefaultTimeoutMs(),
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Long dwell sessions are single-threaded; keep parallel workers for normal suites.
  workers: process.env.SESSION_ENABLED === 'true' ? 1 : process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['line'], ['blob', process.env.BLOB_REPORT_FILE
      ? { outputFile: process.env.BLOB_REPORT_FILE }
      : { outputDir: 'blob-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: process.env.TEST_RESULTS_DIR ?? 'test-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.twitch.tv/strykerusa',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: false,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
});
