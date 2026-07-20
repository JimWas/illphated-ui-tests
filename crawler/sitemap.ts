import type { APIRequestContext } from '@playwright/test';
import { normalizeUrl } from './url-utils.js';

export async function discoverSitemapUrls(request: APIRequestContext, rootUrl: string): Promise<string[]> {
  const origin = new URL(rootUrl).origin;
  const pending = [new URL('/sitemap.xml', origin).toString()];
  const visited = new Set<string>();
  const pages = new Set<string>();
  while (pending.length) {
    const sitemap = pending.shift()!;
    if (visited.has(sitemap)) continue;
    visited.add(sitemap);
    try {
      const response = await request.get(sitemap, { timeout: 20_000 });
      if (!response.ok()) continue;
      const xml = await response.text();
      const locations = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].replace(/&amp;/g, '&'));
      for (const location of locations) {
        if (/\.xml(?:\?|$)/i.test(location)) pending.push(location);
        else {
          const normalized = normalizeUrl(location, origin, origin);
          if (normalized) pages.add(normalized);
        }
      }
    } catch (error) {
      console.warn(`Unable to read sitemap ${sitemap}: ${String(error)}`);
    }
  }
  return [...pages];
}
