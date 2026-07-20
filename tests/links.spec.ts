import { test, expect } from '@playwright/test';
import { testPages } from '../utils/pages.js';

for (const url of testPages()) {
  test(`internal links: ${url}`, async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Link checks run once per URL');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const origin = new URL(url).origin;
    const links = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
    const internal = [...new Set(links.filter((href) => { try { return new URL(href).origin === origin; } catch { return false; } }))];
    const broken: string[] = [];
    await Promise.all(internal.map(async (href) => {
      try {
        const response = await request.get(href, { timeout: 20_000, failOnStatusCode: false });
        if (response.status() >= 400) broken.push(`${response.status()} ${href}`);
      } catch (error) { broken.push(`${href}: ${String(error)}`); }
    }));
    expect(broken, 'Broken internal links').toEqual([]);
  });
}
