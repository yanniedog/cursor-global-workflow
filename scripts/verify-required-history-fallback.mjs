import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchRequiredCheckState } from './lib/required-ci-checks.mjs';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'required-history-'));
const savedPath = process.env.PATH;
try {
  const row = { name: 'product-ci', workflow: 'ci', link: 'https://github.com/example/repo/actions/runs/1/job/2', bucket: 'pass', state: 'SUCCESS', startedAt: '2026-10-11T00:00:00Z' };
  const fixtures = [row, { ...row, startedAt: '0001-01-01T00:00:00Z', bucket: 'pending', state: 'QUEUED' }];
  fs.writeFileSync(path.join(temp, 'gh'), `#!/usr/bin/env node\nconst args=process.argv.slice(2);\nif(args[0]==='pr') {console.log(${JSON.stringify(JSON.stringify(fixtures))});process.exit(8);}\nif(args[1].includes('protection')||args[1].includes('/rules/')) {process.exit(1);}\nconsole.log(JSON.stringify({check_runs:[{name:'bot-feedback-gate',status:'completed',conclusion:'success'}],statuses:[]}));\n`, { mode: 0o755 });
  process.env.PATH = temp + path.delimiter + savedPath;
  const result = fetchRequiredCheckState({ prNumber: 1, repo: 'example/repo', headSha: 'abc' });
  assert.match(result.error, /Cannot order duplicate check runs: product-ci/);
} finally {
  process.env.PATH = savedPath;
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('Ambiguous required-history API fallback regression passed');
