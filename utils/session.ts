/**
 * Session dwell helpers: keep a live page on BASE_URL for a bounded duration.
 * Duration is clamped to 20–60 minutes unless SESSION_ALLOW_ANY_DURATION=true.
 */

export const SESSION_MIN_MINUTES = 20;
export const SESSION_MAX_MINUTES = 60;
export const DEFAULT_SESSION_MINUTES = 20;
export const DEFAULT_CHECK_INTERVAL_MS = 30_000;

export function resolveSessionDurationMs(): number {
  const raw = Number(process.env.SESSION_DURATION_MINUTES ?? DEFAULT_SESSION_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error(`Invalid SESSION_DURATION_MINUTES: ${process.env.SESSION_DURATION_MINUTES}`);
  }

  const allowAny = process.env.SESSION_ALLOW_ANY_DURATION === 'true';
  const minutes = allowAny
    ? raw
    : Math.min(SESSION_MAX_MINUTES, Math.max(SESSION_MIN_MINUTES, raw));

  if (!allowAny && raw !== minutes) {
    console.warn(
      `SESSION_DURATION_MINUTES=${raw} clamped to ${minutes} (allowed range ${SESSION_MIN_MINUTES}–${SESSION_MAX_MINUTES}). ` +
        `Set SESSION_ALLOW_ANY_DURATION=true to override.`
    );
  }

  return Math.round(minutes * 60_000);
}

export function resolveCheckIntervalMs(): number {
  const raw = Number(process.env.SESSION_CHECK_INTERVAL_MS ?? DEFAULT_CHECK_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < 1_000) {
    throw new Error(`Invalid SESSION_CHECK_INTERVAL_MS: ${process.env.SESSION_CHECK_INTERVAL_MS}`);
  }
  return Math.floor(raw);
}

export function resolveBaseUrl(): string {
  return process.env.BASE_URL ?? 'https://www.twitch.tv/strykerusa';
}

/** True when the live URL is still on the configured base URL (same origin + path prefix). */
export function isStillOnBaseUrl(liveUrl: string, baseUrl: string): boolean {
  try {
    const live = new URL(liveUrl);
    const base = new URL(baseUrl);
    if (live.origin !== base.origin) return false;

    const basePath = base.pathname.replace(/\/+$/, '') || '/';
    const livePath = live.pathname.replace(/\/+$/, '') || '/';
    if (basePath === '/') return true;
    return livePath === basePath || livePath.startsWith(`${basePath}/`);
  } catch {
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
