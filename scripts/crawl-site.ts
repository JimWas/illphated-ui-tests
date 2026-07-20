import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { crawlSite } from '../crawler/crawler.js';

const output = resolve(process.env.PAGES_FILE ?? 'test-data/pages.json');
const pages = await crawlSite({
  baseUrl: process.env.BASE_URL ?? 'https://illphated.com',
  maxPages: Number(process.env.MAX_PAGES ?? 1000),
  timeoutMs: Number(process.env.CRAWL_TIMEOUT_MS ?? 30_000),
  concurrency: Number(process.env.CRAWL_CONCURRENCY ?? 4)
});
if (!pages.length) throw new Error('Crawler found no pages');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(pages, null, 2)}\n`);
console.log(`Saved ${pages.length} URLs to ${output}`);
