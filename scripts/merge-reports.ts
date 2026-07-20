import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const input = process.env.BLOB_REPORT_DIR ?? 'all-blob-reports';
if (!existsSync(input)) throw new Error(`Report directory does not exist: ${input}`);
execFileSync('npx', ['playwright', 'merge-reports', '--reporter', 'html', input], { stdio: 'inherit' });
