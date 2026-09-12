import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fetchPrChangedPaths, isReportsOnlyFileList } from './lib/pr-reports-only.mjs';
const pages = [Array.from({ length: 100 }, (_, i) => ({ filename: `reports/${i}.json` })), [{ filename: 'src/auth.ts' }]];
const fakeGh = args => {
  if (args[0] === 'repo') return { nameWithOwner: 'owner/repo' };
  if (args[0] === 'pr') return { changedFiles: 101 };
  assert.ok(args.includes('--paginate'));
  assert.ok(args.includes('--slurp'));
  return pages;
};
assert.equal(isReportsOnlyFileList(fetchPrChangedPaths(1, fakeGh)), false);
assert.throws(() => fetchPrChangedPaths(1, args => args[0] === 'api' ? [pages[0]] : fakeGh(args)), /Incomplete/);
const directory = mkdtempSync(join(tmpdir(), 'cgw-syntax-'));
try {
  writeFileSync(join(directory, 'valid.mjs'), 'export const n = 1;');
  assert.equal(spawnSync(process.execPath, ['scripts/verify-syntax.mjs', directory]).status, 0);
  writeFileSync(join(directory, 'invalid.mjs'), 'export const = ;');
  assert.equal(spawnSync(process.execPath, ['scripts/verify-syntax.mjs', directory]).status, 1);
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log('Review request pagination and syntax failure regression checks passed');
