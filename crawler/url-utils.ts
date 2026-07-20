const IGNORED_PROTOCOLS = /^(mailto:|tel:|javascript:|data:)/i;
const IGNORED_EXTENSIONS = /\.(?:7z|avi|css|docx?|eot|gif|ico|jpe?g|js|json|mov|mp3|mp4|pdf|png|rar|svg|tar|ttf|webm|webp|woff2?|xml|zip)$/i;

export function normalizeUrl(value: string, base: string, siteOrigin: string): string | null {
  if (!value || value.startsWith('#') || IGNORED_PROTOCOLS.test(value)) return null;
  try {
    const url = new URL(value, base);
    if (url.origin !== siteOrigin || !['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    [...url.searchParams.keys()].forEach((key) => {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    });
    if (IGNORED_EXTENSIONS.test(url.pathname)) return null;
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

export function isCrawlable(url: string, origin: string): boolean {
  try { return new URL(url).origin === origin; } catch { return false; }
}
