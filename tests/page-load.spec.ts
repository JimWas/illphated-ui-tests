import { test, expect } from '@playwright/test';
import { monitorPage } from '../utils/browser.js';
import { capturePage } from '../utils/screenshots.js';
import { testPages } from '../utils/pages.js';

for (const url of testPages()) {
  test(`page health: ${url}`, async ({ page }, testInfo) => {
    const problems = monitorPage(page);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(response, 'Navigation returned no response').not.toBeNull();
    expect(response!.status(), 'HTTP status').toBeLessThan(400);
    await page.waitForLoadState('load');
    await capturePage(page, url, testInfo);
    expect((await page.title()).trim(), 'Page title').not.toBe('');
    const description = page.locator('meta[name="description"]');
    await expect(description, 'Meta description').toHaveAttribute('content', /\S+/);
    const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0).map((image) => (image as HTMLImageElement).src));
    expect(brokenImages, 'Broken images').toEqual([]);
    expect(problems.consoleErrors, 'Console errors').toEqual([]);
    expect(problems.pageErrors, 'Uncaught exceptions').toEqual([]);
    expect(problems.failedRequests, 'Failed network requests').toEqual([]);
  });
}
