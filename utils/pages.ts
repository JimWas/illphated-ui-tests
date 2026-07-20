import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function testPages(): string[] {
  const file = resolve(process.env.PAGES_FILE ?? 'test-data/pages.json');
  const pages: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(pages) || !pages.every((page) => typeof page === 'string')) throw new Error(`Invalid pages file: ${file}`);
  return pages;
}
