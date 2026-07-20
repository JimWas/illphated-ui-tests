import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export async function writeJsonReport(relativePath: string, value: unknown): Promise<void> {
  const [root, ...rest] = relativePath.split('/');
  const path = resolve(root, ...(process.env.REPORT_RUN_ID ? [process.env.REPORT_RUN_ID] : []), ...rest);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
