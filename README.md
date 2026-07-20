# illphated-ui-tests

Production-grade Playwright monitoring for every discoverable page on [illphated.com](https://illphated.com). It combines browser health checks, responsive coverage, axe accessibility scans, Lighthouse audits, link validation, screenshots, and visual regression testing.

## Install and run

Requirements: Node.js 22+ and npm.

```bash
npm install
npx playwright install chromium
npm run crawl
npm test
```

The crawler renders pages in Chromium, follows internal links, reads nested sitemaps, normalizes URLs, removes duplicates, and writes `test-data/pages.json`. Configure it with `BASE_URL`, `MAX_PAGES`, `CRAWL_TIMEOUT_MS`, and `CRAWL_CONCURRENCY`.

Useful commands:

```bash
npm run typecheck
npm run shard
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

`ui-tests.yml` runs on pushes, pull requests, manual dispatches, and as a reusable workflow. Its discovery job crawls the live site and divides the resulting array by round-robin assignment into at most 20 non-empty shard files. The matrix is generated from the crawl result; URLs are not hardcoded in the test suites. Up to 20 Ubuntu runners then receive their own shard file and execute all suites. `fail-fast` is disabled so one failure does not hide results from other shards.

The final job downloads all runner output, merges Playwright blob reports into one HTML report, uploads the combined artifact, and writes passed/failed page status plus accessibility and performance report links to the workflow summary. Open an Actions run and choose **Artifacts → combined-report**. Individual shard artifacts include Lighthouse HTML/JSON, axe JSON, screenshots, traces, and videos.

`scheduled-monitor.yml` invokes the same pipeline every day at 06:17 UTC and also supports manual runs.

## Notifications

Add either repository Actions secret to enable failure-only notifications:

- `SLACK_WEBHOOK_URL`
- `DISCORD_WEBHOOK_URL`

No notification step runs when its secret is absent or the tests pass.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `BASE_URL` | `https://illphated.com` | Crawl origin |
| `PAGES_FILE` | `test-data/pages.json` | Test URL input |
| `SHARD_COUNT` | `20` | Maximum shards |
| `MAX_PAGES` | `1000` | Crawl safety limit |
| `TEST_TIMEOUT_MS` | `60000` | Per-test timeout |
| `LIGHTHOUSE_MIN_SCORE` | `0.70` | Category threshold |
| `MAX_DIFF_PIXEL_RATIO` | `0.01` | Visual tolerance |

## Adding authentication

Create a Playwright setup project that signs in once, saves `storageState` to a gitignored file, and make the browser projects depend on it. Put credentials in GitHub Actions secrets and read them from environment variables—never commit them. For token or cookie authentication, create the context state through the API in the setup project. If authenticated and public routes must both be tested, maintain separate projects and storage-state files.

## Repository layout

- `crawler/`: rendered-link and sitemap discovery
- `scripts/`: crawl, shard, and report commands
- `tests/`: health, accessibility, Lighthouse, visual, and link suites
- `utils/`: browser monitoring, screenshots, reporting, and page loading
- `test-data/`: discovered URL manifest and generated shards
- `.github/workflows/`: event-driven and scheduled monitoring
