import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

export async function capturePage(page: Page, url: string, testInfo: TestInfo): Promise<void> {
  const slug = new URL(url).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
  const directory = resolve(process.env.SCREENSHOT_DIR ?? 'artifacts/screenshots', testInfo.project.name);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `${slug}.png`), fullPage: true });
}
