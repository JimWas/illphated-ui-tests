import { expect, type Page } from '@playwright/test';

/** Inspect decoded playback and captured audio without rerouting the player's output. */
export async function sampleMedia(page: Page, sampleMs = 10_000) {
  return page.locator('video:visible').first().evaluate(async (element, duration) => {
    const video = element as HTMLVideoElement & { captureStream(): MediaStream };
    const startTime = video.currentTime;
    const startFrames = video.getVideoPlaybackQuality().totalVideoFrames;
    const context = new AudioContext();
    let stream: MediaStream | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let peak = 0;
    let audioError: string | undefined;
    let tracks = 0;
    try {
      await context.resume();
      try {
        stream = video.captureStream();
        tracks = stream.getAudioTracks().length;
        if (tracks) source = context.createMediaStreamSource(stream);
      } catch (error) { audioError = String(error); }
      const analyser = context.createAnalyser();
      source?.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const end = performance.now() + duration;
      while (performance.now() < end) {
        analyser.getFloatTimeDomainData(samples);
        for (const value of samples) peak = Math.max(peak, Math.abs(value));
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return {
        timeAdvanced: video.currentTime - startTime,
        framesAdvanced: video.getVideoPlaybackQuality().totalVideoFrames - startFrames,
        paused: video.paused, ended: video.ended, readyState: video.readyState,
        muted: video.muted, volume: video.volume, tracks, peak, audioError,
        mediaError: video.error?.message,
        attached: video.isConnected,
        audioContextState: context.state
      };
    } finally {
      source?.disconnect();
      // Do not stop captured tracks: Chromium can share them with srcObject playback.
      await context.close();
    }
  }, sampleMs, { timeout: 5_000 });
}

export async function startMedia(page: Page) {
  const video = page.locator('video:visible').first();
  await video.waitFor({ state: 'visible', timeout: 5_000 });
  // A real interaction permits audible playback under browser autoplay rules.
  await video.click({ timeout: 5_000 });
  await video.evaluate(async (element) => {
    const media = element as HTMLVideoElement;
    media.muted = false;
    media.volume = 1;
    await Promise.race([
      media.play(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Player did not start within 5 seconds')), 5_000))
    ]);
  });
}

export async function checkMedia(page: Page, sampleMs = 10_000) {
  const result = await sampleMedia(page, sampleMs);
  const details = JSON.stringify(result);
  try {
    expect(result.attached, details).toBe(true);
    expect(result.mediaError, details).toBeUndefined();
    expect(result.paused || result.ended, details).toBe(false);
    expect(result.readyState, details).toBeGreaterThanOrEqual(2);
    expect(result.timeAdvanced, `Playback stalled: ${details}`).toBeGreaterThan(0.1);
    expect(result.framesAdvanced, `No video frames decoded: ${details}`).toBeGreaterThan(0);
    expect(result.muted, details).toBe(false);
    expect(result.volume, details).toBeGreaterThan(0);
    expect(result.audioError, `Audio capture unavailable: ${details}`).toBeUndefined();
    expect(result.tracks, `No audio track: ${details}`).toBeGreaterThan(0);
    expect(result.audioContextState, details).toBe('running');
    expect(result.peak, `No non-silent audio detected: ${details}`).toBeGreaterThan(0.0001);
    return result;
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { measurements: result });
  }
}
