import type { Page, TestInfo } from '@playwright/test';
import { checkMedia, startMedia } from './media.js';
import { resolveSessionStartupMs } from './session.js';
import { inspectPlayer, interruptionExpired } from './player-state.js';

export function createMediaMonitor(page: Page, testInfo: TestInfo) {
  const history: unknown[] = [];
  let attempt = 0;
  return {
    async check(startup = false) {
      const began = Date.now();
      let failures = 0;
      let adSince: number | undefined;
      while (true) {
        attempt += 1;
        const before = await inspectPlayer(page);
        let media: unknown;
        try {
          if (before.state === 'ad') {
            adSince ??= Date.now();
            throw new Error('Advertisement visible; waiting for channel playback');
          }
          adSince = undefined;
          if (['offline', 'consent', 'error', 'missing'].includes(before.state)) {
            throw new Error(`Player ${before.state}: ${before.evidence}`);
          }
          if (startup || before.state === 'paused') await startMedia(page);
          media = await checkMedia(page);
          const after = await inspectPlayer(page);
          if (after.state !== 'playing') throw new Error(`Player transitioned to ${after.state}: ${after.evidence}`);
          history.push({ at: new Date().toISOString(), attempt, startup, before, after, media, healthy: true });
          return;
        } catch (error) {
          failures += 1;
          if (error && typeof error === 'object' && 'measurements' in error) media = error.measurements;
          const after = await inspectPlayer(page).catch(() => before);
          const record = { at: new Date().toISOString(), attempt, startup, failures, before, after, media, error: String(error) };
          history.push(record);
          await testInfo.attach(`media-failure-${attempt}`, {
            body: JSON.stringify(record, null, 2), contentType: 'application/json'
          });
          try {
            await testInfo.attach(`media-failure-${attempt}-screenshot`, {
              body: await page.screenshot({ timeout: 5_000 }), contentType: 'image/png'
            });
          } catch (captureError) {
            await testInfo.attach(`media-failure-${attempt}-screenshot-error`, {
              body: String(captureError), contentType: 'text/plain'
            });
          }
          console.log(`Media interruption #${failures}: ${String(error)}`);
          const elapsed = Date.now() - began;
          const expired = startup
            ? elapsed >= resolveSessionStartupMs()
            : elapsed >= 180_000 || interruptionExpired(failures, elapsed, false, adSince !== undefined);
          if (expired) {
            throw new Error(`Media did not recover (${after.state}, ${failures} failed checks): ${String(error)}`);
          }
          await page.waitForTimeout(5_000);
        }
      }
    },
    async attachHistory() {
      await testInfo.attach('media-history', { body: JSON.stringify(history, null, 2), contentType: 'application/json' });
    }
  };
}
