import { defineConfig } from '@playwright/test';

/**
 * Default per-test timeout is 60s. Session dwell needs far longer, so when
 * SESSION_ENABLED=true (or TEST_TIMEOUT_MS is set), use an explicit budget.
 * Duration is clamped the same way as utils/session.ts (20–60 min) unless
 * SESSION_ALLOW_ANY_DURATION=true.
 */
function resolveDefaultTimeoutMs(): number {
  if (process.env.TEST_TIMEOUT_MS) {
    return Number(process.env.TEST_TIMEOUT_MS);
  }

  if (process.env.SESSION_ENABLED === 'true') {
    const raw = Number(process.env.SESSION_DURATION_MINUTES ?? 20);
    const allowAny = process.env.SESSION_ALLOW_ANY_DURATION === 'true';
    const minutes = allowAny
      ? (Number.isFinite(raw) && raw > 0 ? raw : 20)
      : Math.min(60, Math.max(20, Number.isFinite(raw) && raw > 0 ? raw : 20));
    // Session length + buffer for navigation, screenshot, and teardown.
    return Math.round(minutes * 60_000) + 5 * 60_000;
  }

  return 60_000;
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
