import { chromium, request } from '@playwright/test';
import { discoverSitemapUrls } from './sitemap.js';
import { normalizeUrl } from './url-utils.js';

export interface CrawlOptions { baseUrl: string; maxPages: number; timeoutMs: number; concurrency: number }

export async function crawlSite(options: CrawlOptions): Promise<string[]> {
  const origin = new URL(options.baseUrl).origin;
  const api = await request.newContext();
  const sitemapUrls = options.maxPages > 1 ? await discoverSitemapUrls(api, options.baseUrl) : [];
  await api.dispose();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  // Respect the safety cap for sitemap seeds as well as rendered links.
  const queue = [normalizeUrl(options.baseUrl, options.baseUrl, origin)!, ...sitemapUrls].slice(0, options.maxPages);
  const discovered = new Set(queue);
  const visited = new Set<string>();

  async function worker(): Promise<void> {
    const page = await context.newPage();
    while (visited.size < options.maxPages) {
      const url = queue.shift();
      if (!url) break;
      if (visited.has(url)) continue;
      visited.add(url);
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
        if (!response || response.status() >= 400) continue;
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
        const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
        for (const href of hrefs) {
          const normalized = normalizeUrl(href, url, origin);
          if (normalized && !discovered.has(normalized) && discovered.size < options.maxPages) {
            discovered.add(normalized);
            queue.push(normalized);
          }
        }
      } catch (error) {
        console.warn(`Crawl failed for ${url}: ${String(error)}`);
      }
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
  await browser.close();
  return [...discovered].sort();
}
