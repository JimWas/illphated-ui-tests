import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { testPages } from '../utils/pages.js';
import { writeJsonReport } from '../utils/reports.js';

for (const url of testPages()) {
  test(`accessibility: ${url}`, async ({ page }, testInfo) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const slug = Buffer.from(url).toString('base64url');
    await writeJsonReport(`accessibility-reports/${testInfo.project.name}/${slug}.json`, results);
    const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(serious, `Serious accessibility violations:\n${serious.map((v) => `${v.id}: ${v.help}`).join('\n')}`).toEqual([]);
  });
}
