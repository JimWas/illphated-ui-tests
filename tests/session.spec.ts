import { test, expect } from '@playwright/test';
import { monitorPage } from '../utils/browser.js';
import { capturePage } from '../utils/screenshots.js';
import {
  isStillOnBaseUrl,
  resolveBaseUrl,
  resolveCheckIntervalMs,
  resolveSessionDurationMs,
  sleep
} from '../utils/session.js';

/**
 * Long-lived session: open BASE_URL and remain there for 20–60 minutes while
 * periodically verifying the tab has not navigated away and collecting errors.
 *
 * Only runs when SESSION_ENABLED=true so the default suite stays fast.
 *   BASE_URL=https://example.com SESSION_DURATION_MINUTES=30 npm run test:session
 */
const sessionEnabled = process.env.SESSION_ENABLED === 'true';

test.describe('session dwell', () => {
  test.skip(!sessionEnabled, 'Set SESSION_ENABLED=true (or use npm run test:session)');

  test('stay on BASE_URL for the session duration', async ({ page }, testInfo) => {
    // Only one long session is needed; desktop is enough.
    test.skip(testInfo.project.name !== 'desktop', 'Session dwell runs once on desktop');

    const baseUrl = resolveBaseUrl();
    const durationMs = resolveSessionDurationMs();
    const checkIntervalMs = resolveCheckIntervalMs();
    // Buffer for navigation, final checks, and screenshot.
    test.setTimeout(durationMs + 5 * 60_000);

    const problems = monitorPage(page);
    const startedAt = Date.now();
    const endsAt = startedAt + durationMs;

    console.log(
      `Session dwell: ${baseUrl} for ${Math.round(durationMs / 60_000)} min ` +
        `(check every ${Math.round(checkIntervalMs / 1000)}s)`
    );

    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    expect(response, 'Navigation returned no response').not.toBeNull();
    expect(response!.status(), 'HTTP status').toBeLessThan(400);
    await page.waitForLoadState('load').catch(() => undefined);

    let checks = 0;
    while (Date.now() < endsAt) {
      checks += 1;
      const liveUrl = page.url();
      expect(
        isStillOnBaseUrl(liveUrl, baseUrl),
        `Left BASE_URL during session (live=${liveUrl}, base=${baseUrl})`
      ).toBe(true);

      // Soft re-assert load state without failing on long-lived SPAs.
      const title = (await page.title().catch(() => '')).trim();
      expect(title, `Empty document title at check #${checks}`).not.toBe('');

      if (problems.pageErrors.length) {
        expect(problems.pageErrors, 'Uncaught exceptions during session').toEqual([]);
      }

      const remaining = endsAt - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(checkIntervalMs, remaining));
    }

    const elapsedMin = ((Date.now() - startedAt) / 60_000).toFixed(1);
    console.log(`Session complete after ${elapsedMin} min and ${checks} checks on ${page.url()}`);

    expect(isStillOnBaseUrl(page.url(), baseUrl), 'Final URL still on BASE_URL').toBe(true);
    await capturePage(page, baseUrl, testInfo);

    // Console noise is common on third-party sites (Twitch, ads); fail only on hard crashes
    // and hard network failures already tracked via pageerrors. Surface console for the report.
    testInfo.annotations.push({
      type: 'session',
      description: `dwell=${elapsedMin}m checks=${checks} consoleErrors=${problems.consoleErrors.length} failedRequests=${problems.failedRequests.length}`
    });
  });
});
