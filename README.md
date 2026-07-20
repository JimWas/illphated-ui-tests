# illphated-ui-tests

Production-grade Playwright monitoring for [twitch.tv/strykerusa](https://www.twitch.tv/strykerusa). It combines browser health checks, responsive coverage, axe accessibility scans, Lighthouse audits, link validation, screenshots, and visual regression testing.

## Install and run

Requirements: Node.js 22+ and npm.

```bash
npm install
npx playwright install chromium
npm run crawl
npm test
```

The crawler renders the target in Chromium and writes `test-data/pages.json`. It supports internal links and nested sitemaps, but this workflow sets `MAX_PAGES=1` so all 20 forced shards test the requested Twitch channel rather than crawling Twitch's entire platform. Configure it with `BASE_URL`, `MAX_PAGES`, `CRAWL_TIMEOUT_MS`, and `CRAWL_CONCURRENCY`.

### Stay on BASE_URL (20–60 minute session)

To keep a live Chromium tab on the target URL for a sustained session (without crawling away), run:

```bash
BASE_URL=https://www.twitch.tv/strykerusa SESSION_DURATION_MINUTES=30 npm run test:session
```

- Duration defaults to **20** minutes and is clamped to **20–60** minutes.
- Set `SESSION_ALLOW_ANY_DURATION=true` only if you intentionally need outside that range.
- The session re-checks every 30s (`SESSION_CHECK_INTERVAL_MS`) that the tab is still on `BASE_URL` and that the document still has a title; uncaught page exceptions fail the run.
- Default `npm test` stays fast: the long session is **opt-in** via `npm run test:session` (or `SESSION_ENABLED=true`).

Useful commands:

```bash
npm run typecheck
npm run shard
npm run test:session
npm run test:update-snapshots
npm run merge-reports
```

## Coverage

Each URL runs at desktop (1440×900), tablet (768×1024), and mobile (390×844) sizes. The suites check HTTP status, load completion, title and description, browser exceptions, console errors, failed requests, broken images, internal links, WCAG A/AA violations, Lighthouse category scores, and visual changes. Playwright retains full-page failure screenshots, video, and traces. A page screenshot is also captured on every successful page-health run.

Serious and critical axe violations fail accessibility tests. Lighthouse's default minimum for performance, accessibility, best practices, and SEO is `0.70`; change it with `LIGHTHOUSE_MIN_SCORE`. Visual tolerance is controlled by `MAX_DIFF_PIXEL_RATIO` (default `0.01`).

## Visual baselines

Create and commit local baselines with:

```bash
npm run crawl
npm run test:update-snapshots
git add tests/visual.spec.ts-snapshots
```

CI initializes Linux baselines only when a shard has no cached or committed Linux snapshots, and the Actions cache carries them into later runs. This platform-specific check matters because locally committed macOS snapshots cannot be compared with Linux rendering. Existing Linux snapshots are never updated during a CI comparison, so rendering regressions fail. A newly discovered route in an established shard therefore fails until its baseline is deliberately reviewed and added. Commit baselines for the most deterministic review workflow.

## GitHub Actions and 20-way sharding

`ui-tests.yml` runs on pushes, pull requests, manual dispatches, and as a reusable workflow. Its discovery job crawls the live site and creates exactly 20 non-empty shard files by default. URLs are divided by round-robin assignment when at least 20 pages exist. When fewer than 20 pages exist, discovered URLs are cycled across the shards so all 20 Ubuntu runners still execute real tests concurrently. URLs are never hardcoded in the test suites. `fail-fast` is disabled so one failure does not hide results from other shards.

The final job downloads all runner output, merges Playwright blob reports into one HTML report, uploads the combined artifact, and writes passed/failed page status plus accessibility and performance report links to the workflow summary. Open an Actions run and choose **Artifacts → combined-report**. Individual shard artifacts include Lighthouse HTML/JSON, axe JSON, screenshots, traces, and videos. All crawler, shard, and combined-report artifacts are retained for 90 days so the team can review them asynchronously.

`scheduled-monitor.yml` invokes the same pipeline every day at 06:17 UTC and also supports manual runs.

### Continuous 20-runner mode

Open **Actions → UI tests → Run workflow**, enable **Keep every shard running**, and choose the delay and maximum runtime. The defaults repeat the complete suite on all 20 runners, pause 60 seconds between iterations, and stop after 300 minutes. Pushes, pull requests, and scheduled monitoring remain one-shot runs.

Every iteration gets its own Playwright blob report, test-results directory, screenshots, Lighthouse reports, and accessibility reports. A failed iteration is recorded but does not stop the loop. When the time limit is reached, the shard reports failure if any iteration failed. Click **Cancel workflow** at any time to stop all running and queued shards. GitHub-hosted runners impose an absolute job limit, so the workflow timeout is capped at six hours.

## Notifications

Add either repository Actions secret to enable failure-only notifications:

- `SLACK_WEBHOOK_URL`
- `DISCORD_WEBHOOK_URL`

No notification step runs when its secret is absent or the tests pass.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `BASE_URL` | `https://www.twitch.tv/strykerusa` | Target channel URL |
| `PAGES_FILE` | `test-data/pages.json` | Test URL input |
| `SHARD_COUNT` | `20` | Exact number of concurrent shard jobs |
| `MAX_PAGES` | `1` | Crawl safety limit; prevents platform-wide Twitch crawling |
| `TEST_TIMEOUT_MS` | `60000` | Per-test timeout |
| `LIGHTHOUSE_MIN_SCORE` | `0.70` | Category threshold |
| `MAX_DIFF_PIXEL_RATIO` | `0.01` | Visual tolerance |
| `SESSION_ENABLED` | (unset) | Set `true` to run the long dwell test (`npm run test:session`) |
| `SESSION_DURATION_MINUTES` | `20` | How long to stay on `BASE_URL` (clamped 20–60) |
| `SESSION_CHECK_INTERVAL_MS` | `30000` | Health-check interval during the session |
| `SESSION_ALLOW_ANY_DURATION` | (unset) | Set `true` to allow durations outside 20–60 minutes |

## Adding authentication

Create a Playwright setup project that signs in once, saves `storageState` to a gitignored file, and make the browser projects depend on it. Put credentials in GitHub Actions secrets and read them from environment variables—never commit them. For token or cookie authentication, create the context state through the API in the setup project. If authenticated and public routes must both be tested, maintain separate projects and storage-state files.

## Repository layout

- `crawler/`: rendered-link and sitemap discovery
- `scripts/`: crawl, shard, and report commands
- `tests/`: health, accessibility, Lighthouse, visual, and link suites
- `utils/`: browser monitoring, screenshots, reporting, and page loading
- `test-data/`: discovered URL manifest and generated shards
- `.github/workflows/`: event-driven and scheduled monitoring
