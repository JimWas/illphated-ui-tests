import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pages = JSON.parse(await readFile(resolve(process.env.PAGES_FILE ?? 'test-data/pages.json'), 'utf8')) as string[];
if (!Array.isArray(pages) || pages.length === 0) throw new Error('No pages available to shard');
const shardCount = Number(process.env.SHARD_COUNT ?? 20);
if (!Number.isInteger(shardCount) || shardCount < 1) throw new Error('SHARD_COUNT must be a positive integer');
const outputDir = resolve(process.env.SHARD_DIR ?? 'test-data/shards');
await mkdir(outputDir, { recursive: true });
const matrix = Array.from({ length: shardCount }, (_, index) => index + 1);
for (let index = 0; index < shardCount; index += 1) {
  // Keep every runner useful. If there are fewer URLs than runners, cycle the
  // discovered URLs so all requested runners execute a real browser test.
  const assigned = pages.length < shardCount
    ? [pages[index % pages.length]]
    : pages.filter((_, pageIndex) => pageIndex % shardCount === index);
  await writeFile(resolve(outputDir, `shard-${index + 1}.json`), `${JSON.stringify(assigned, null, 2)}\n`);
}
await writeFile(resolve(outputDir, 'matrix.json'), `${JSON.stringify(matrix)}\n`);
console.log(JSON.stringify({ pages: pages.length, shards: shardCount, duplicatedAssignments: pages.length < shardCount, matrix }));
