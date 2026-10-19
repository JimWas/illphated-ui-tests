import { test, expect } from '@playwright/test';
import { checkMedia, sampleMedia } from '../utils/media.js';

test('detects playing video and audio, silence, mute, and pause', async ({ page }) => {
  await page.goto('about:blank');
  await page.setContent('<canvas width="160" height="90"></canvas><video autoplay></video><button>Start</button>');
  await page.evaluate(() => {
    document.querySelector('button')!.onclick = async () => {
      const canvas = document.querySelector('canvas')!;
      const drawing = canvas.getContext('2d')!;
      setInterval(() => {
        drawing.fillStyle = `hsl(${Date.now() % 360}, 100%, 50%)`;
        drawing.fillRect(0, 0, 160, 90);
      }, 33);
      const audio = new AudioContext();
      await audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const destination = audio.createMediaStreamDestination();
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      const stream = canvas.captureStream(30);
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      const video = document.querySelector('video')!;
      video.srcObject = stream;
      await video.play();
      Object.assign(window, { fixtureGain: gain });
    };
  });
  await page.getByRole('button').click();
  await checkMedia(page, 1_000);
  await page.evaluate(() => {
    (window as unknown as { fixtureGain: GainNode }).fixtureGain.gain.value = 0;
  });
  await expect(checkMedia(page, 1_000)).rejects.toThrow('No non-silent audio');
  await page.locator('video').evaluate((video) => { (video as HTMLVideoElement).muted = true; });
  expect((await sampleMedia(page, 300)).muted).toBe(true);
  await page.locator('video').evaluate((video) => (video as HTMLVideoElement).pause());
  const paused = await sampleMedia(page, 300);
  expect(paused.paused).toBe(true);
  expect(paused.timeAdvanced).toBe(0);
});

import { inspectPlayer, interruptionExpired } from '../utils/player-state.js';
import { createMediaMonitor } from '../utils/media-monitor.js';
import type { TestInfo } from '@playwright/test';

test('classifies Twitch overlays using visible, player-scoped evidence', async ({ page }) => {
  for (const [markup, state] of [
    ['<div data-a-target="offline-channel-main-content">Currently offline</div>', 'offline'],
    ['<div data-a-target="video-player"><div data-a-target="player-error-message">Network error #2000</div></div>', 'error'],
    ['<div data-a-target="video-ad-label">Advertisement</div>', 'ad'],
    ['<div role="dialog">Accept all cookies</div>', 'consent'],
    ['<video style="width:160px;height:90px"></video>', 'buffering'],
    ['<aside>Other channel is offline</aside><div hidden data-a-target="video-ad-label">Advertisement</div>', 'missing']
  ]) {
    await page.setContent(markup);
    expect((await inspectPlayer(page)).state).toBe(state);
  }
});

test('brief interruptions recover, repeated failures and bounded ads expire', () => {
  expect(interruptionExpired(1, 10_000, false, false)).toBe(false);
  expect(interruptionExpired(2, 40_000, false, false)).toBe(false);
  expect(interruptionExpired(3, 60_000, false, false)).toBe(true);
  expect(interruptionExpired(1, 90_000, false, false)).toBe(true);
  expect(interruptionExpired(5, 60_000, true, false)).toBe(false);
  expect(interruptionExpired(5, 180_000, true, false)).toBe(true);
  expect(interruptionExpired(5, 60_000, false, true)).toBe(false);
  expect(interruptionExpired(5, 180_000, false, true)).toBe(true);
});

test('repeated consent failures retain diagnostics, screenshots, and history', async ({ page }) => {
  await page.setContent('<div role="dialog">Accept all cookies</div>');
  const attachments: { name: string; contentType: string; body: string | Buffer }[] = [];
  const info = {
    attach: async (name: string, data: { contentType: string; body: string | Buffer }) => { attachments.push({ name, ...data }); }
  } as unknown as TestInfo;
  const monitor = createMediaMonitor(page, info);
  await expect(monitor.check()).rejects.toThrow('consent, 3 failed checks');
  await monitor.attachHistory();
  expect(attachments.filter((item) => item.contentType === 'image/png')).toHaveLength(3);
  const diagnostics = attachments.filter((item) => item.name.match(/^media-failure-\d+$/));
  expect(diagnostics).toHaveLength(3);
  expect(JSON.parse(String(diagnostics[0].body)).before.state).toBe('consent');
  expect(JSON.parse(String(attachments.at(-1)!.body))).toHaveLength(3);
});

import { resolveSessionDurationMs, resolveSessionStartupMs, resolveSessionTimeoutMs } from '../utils/session.js';

test('session budget includes startup plus full dwell and supports over 60 minutes', () => {
  const saved = { ...process.env };
  try {
    delete process.env.SESSION_ALLOW_ANY_DURATION;
    delete process.env.SESSION_DURATION_MINUTES;
    delete process.env.SESSION_START_TIMEOUT_MINUTES;
    expect(resolveSessionDurationMs()).toBe(60 * 60_000);
    expect(resolveSessionStartupMs()).toBe(30 * 60_000);
    expect(resolveSessionTimeoutMs()).toBe(95 * 60_000);
    process.env.SESSION_DURATION_MINUTES = '90';
    expect(resolveSessionDurationMs()).toBe(90 * 60_000);
    expect(resolveSessionTimeoutMs()).toBe(125 * 60_000);
    process.env.SESSION_START_TIMEOUT_MINUTES = '0';
    expect(() => resolveSessionStartupMs()).toThrow('SESSION_START_TIMEOUT_MINUTES');
  } finally {
    for (const key of ['SESSION_ALLOW_ANY_DURATION', 'SESSION_DURATION_MINUTES', 'SESSION_START_TIMEOUT_MINUTES']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
