#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_REQUIRED_KEYS,
  formatRequiredKeys,
  parseRequiredKeys,
  resolveRequiredKeys,
} from './lib/bot-wait-config.mjs';
import { BOT_GATE_CHECK_NAMES } from './lib/pr-gates-lib.mjs';
import {
  combineRequiredCheckState,
  evaluateRequiredCheckState,
} from './lib/required-ci-checks.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

assert.deepEqual(DEFAULT_REQUIRED_KEYS, []);
assert.deepEqual(parseRequiredKeys(undefined), []);
assert.deepEqual(parseRequiredKeys('off'), []);
assert.deepEqual(parseRequiredKeys('none'), []);
assert.deepEqual(parseRequiredKeys('codex,coderabbit'), ['codex', 'coderabbit']);
assert.deepEqual(resolveRequiredKeys([], 'codex'), []);
assert.equal(formatRequiredKeys([]), 'none (reviewers advisory)');
assert.deepEqual(BOT_GATE_CHECK_NAMES, ['bot-feedback-gate']);

const protection = read('scripts/apply-branch-protection.mjs');
assert.match(protection, /const DEFAULT_CHECKS = \['bot-feedback-gate'\]/);
assert.match(protection, /PR_REQUIRED_CHECKS/);
for (const retired of ['bot-presence-gate', 'qwen-code-review', 'local-llm-review']) {
  assert.ok(protection.includes(`'${retired}'`), `${retired} must be retired`);
}

for (const workflow of [
  '.github/workflows/pr-bot-feedback-check.yml',
  'workflows/pr-bot-feedback-check.yml',
  'templates/.github/workflows/pr-bot-feedback-check.yml',
]) {
  const yaml = read(workflow);
  assert.match(yaml, /^\s{2}bot-feedback-gate:/m);
  assert.doesNotMatch(yaml, /^\s{2}pr-bot-feedback-check:/m);
  assert.match(yaml, /persist-credentials: false/);
  assert.doesNotMatch(yaml, /^concurrency:/m);
  assert.doesNotMatch(yaml, /pull_request\.head\.sha/);
  assert.doesNotMatch(yaml, /queue:\s*max/);
  assert.match(yaml, /timeout-minutes:\s*5/);
  assert.match(yaml, /PR_STATE=\$\(gh api/);
  assert.doesNotMatch(yaml, /seq\s+1\s+40|sleep\s+60/);
  assert.match(yaml, /types:\s*\[created, edited, deleted\]/);
  assert.match(yaml, /for attempt in 1 2 3 4/);
  assert.match(yaml, /sleep 5/);
}

assert.deepEqual(
  evaluateRequiredCheckState({
    requiredNames: ['repo-ci', 'bot-feedback-gate'],
    prChecks: [],
    headCheckRuns: [{
      id: 10,
      name: 'repo-ci',
      status: 'queued',
      started_at: '2026-01-01T00:00:00Z',
    }],
  }),
  {
    pending: true,
    failed: false,
    failedNames: [],
    pendingNames: ['repo-ci', 'bot-feedback-gate'],
    missingNames: ['bot-feedback-gate'],
    checks: [{ name: 'repo-ci', state: 'pending' }],
  },
);
assert.equal(
  evaluateRequiredCheckState({
    requiredNames: ['repo-ci'],
    prChecks: [{
      name: 'repo-ci',
      bucket: 'pass',
      startedAt: '2026-01-01T00:00:00Z',
    }],
    headCheckRuns: [{
      id: 11,
      name: 'repo-ci',
      status: 'in_progress',
      started_at: '2026-01-01T00:01:00Z',
    }],
  }).pending,
  true,
);
assert.deepEqual(
  combineRequiredCheckState({
    protectionOk: false,
    rulesOk: false,
    fallbackRequiredNames: ['repo-ci', 'bot-feedback-gate'],
  }).values,
  ['repo-ci', 'bot-feedback-gate'],
);
assert.deepEqual(
  combineRequiredCheckState({
    protectionOk: false,
    rulesOk: true,
    rules: [],
    fallbackRequiredNames: ['repo-ci', 'bot-feedback-gate'],
  }).values,
  ['repo-ci', 'bot-feedback-gate'],
);
assert.equal(
  evaluateRequiredCheckState({
    requiredChecks: [{ context: 'repo-ci', appId: 100 }],
    headCheckRuns: [{
      id: 20,
      name: 'repo-ci',
      app: { id: 200 },
      conclusion: 'success',
      completed_at: '2026-01-01T00:00:00Z',
    }],
  }).pending,
  true,
);
assert.equal(
  evaluateRequiredCheckState({
    requiredChecks: [{ context: 'repo-ci', appId: 100 }],
    headCheckRuns: [{
      id: 21,
      name: 'repo-ci',
      app: { id: 100 },
      conclusion: 'success',
      completed_at: '2026-01-01T00:00:00Z',
    }],
  }).pending,
  false,
);

const bootstrap = read('scripts/lib/repo-bootstrap.mjs');
assert.match(bootstrap, /pr-bot-feedback-check\.yml/);
assert.doesNotMatch(bootstrap, /cursor-auto-pr-review\.yml/);
assert.doesNotMatch(bootstrap, /gemini-review\.yml/);
assert.doesNotMatch(bootstrap, /qwen-pr-review\.mjs/);

const creator = read('scripts/create-standard-repo.mjs');
assert.match(creator, /writeFileSync\(join\(target, 'WORKFLOW\.md'\)/);
assert.match(creator, /test: 'node --test'/);
assert.match(creator, /'--package-lock-only', '--ignore-scripts'/);

const installer = read('install.sh');
assert.match(installer, /cp -R "\$ROOT\/templates\/\." "\$TEMPLATES_DEST\/"/);

const waiter = read('scripts/wait_for_bots.mjs');
assert.match(waiter, /git', \['rev-parse', '--git-path', relative\]/);
assert.match(waiter, /--required/);

console.log('review gate policy verification passed');
