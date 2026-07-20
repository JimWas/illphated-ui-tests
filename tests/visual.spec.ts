import { test, expect } from '@playwright/test';
import { testPages } from '../utils/pages.js';

for (const url of testPages()) {
  test(`visual: ${url}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Analytics and other long-lived requests can prevent true network idleness.
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);
    const slug = new URL(url).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
    await expect(page).toHaveScreenshot(`${slug}.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: Number(process.env.MAX_DIFF_PIXEL_RATIO ?? 0.01)
    });
  });
}
