import { test, expect } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { testPages } from '../utils/pages.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const url of testPages()) {
  test(`lighthouse: ${url}`, async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Lighthouse runs once per URL');
    test.setTimeout(120_000);
    const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] });
    try {
      const result = await lighthouse(url, {
        port: chrome.port,
        output: ['html', 'json'],
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
      });
      if (!result) throw new Error(`Lighthouse produced no result for ${url}`);
      const slug = Buffer.from(url).toString('base64url');
      const directory = resolve('lighthouse-reports');
      await mkdir(directory, { recursive: true });
      const reports = Array.isArray(result.report) ? result.report : [result.report];
      await writeFile(resolve(directory, `${slug}.html`), reports[0]);
      await writeFile(resolve(directory, `${slug}.json`), reports[1] ?? JSON.stringify(result.lhr, null, 2));
      const minimum = Number(process.env.LIGHTHOUSE_MIN_SCORE ?? 0.7);
      for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) {
        expect(result.lhr.categories[category]?.score ?? 0, `${category} score`).toBeGreaterThanOrEqual(minimum);
      }
    } finally { await chrome.kill(); }
  });
}
