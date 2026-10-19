import type { Page } from '@playwright/test';

export type PlayerState = 'offline' | 'buffering' | 'ad' | 'consent' | 'error' | 'paused' | 'playing' | 'missing';

/** Twitch's public page has no stable player-state API; retain the UI evidence used. */
export async function inspectPlayer(page: Page): Promise<{ state: PlayerState; evidence: string }> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const text = (selector: string) => Array.from(document.querySelectorAll(selector))
      .filter(visible).map((element) => (element.textContent ?? '').trim()).join(' ').slice(0, 2000);
    const consent = text('[role="dialog"], [data-a-target*="consent"], [data-test-selector*="consent"], [class*="consent-banner"]');
    if (/cookie|consent|privacy choices|accept all/i.test(consent)) return { state: 'consent' as const, evidence: consent };
    const player = text('[data-a-target="video-player"], [data-a-target="player-overlay"], .video-player');
    const error = text('[data-a-target="player-error-message"], [data-test-selector="content-overlay-gate"]');
    if (/error|not supported|unavailable|failed/i.test(error) || /error #\d+|network error|playback error/i.test(player)) {
      return { state: 'error' as const, evidence: error || player };
    }
    const offline = text('[data-a-target="offline-channel-main-content"], [data-test-selector="channel-status-text-indicator"]');
    if (/offline/i.test(offline) || /currently offline|channel is offline/i.test(player)) return { state: 'offline' as const, evidence: offline || player };
    const ad = text('[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"], [data-test-selector="ad-banner-default-text"]');
    if (ad) return { state: 'ad' as const, evidence: ad };
    const video = Array.from(document.querySelectorAll('video')).find(visible);
    if (!video) return { state: 'missing' as const, evidence: player || 'No visible video element' };
    if (video.error) return { state: 'error' as const, evidence: video.error.message };
    if (video.readyState < 3) return { state: 'buffering' as const, evidence: `readyState=${video.readyState}` };
    if (video.paused || video.ended) return { state: 'paused' as const, evidence: `paused=${video.paused} ended=${video.ended}` };
    return { state: 'playing' as const, evidence: `readyState=${video.readyState}` };
  });
}

export function interruptionExpired(failures: number, elapsedMs: number, startup: boolean, ad: boolean): boolean {
  if (startup || ad) return elapsedMs >= 180_000;
  return failures >= 3 || elapsedMs >= 90_000;
}
