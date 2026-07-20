import type { Page } from '@playwright/test';

export interface PageProblems { consoleErrors: string[]; pageErrors: string[]; failedRequests: string[] }

export function monitorPage(page: Page): PageProblems {
  const problems: PageProblems = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on('console', (message) => { if (message.type() === 'error') problems.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => problems.pageErrors.push(error.message));
  page.on('requestfailed', (request) => problems.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`));
  return problems;
}
