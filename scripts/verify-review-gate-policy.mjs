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
}

const bootstrap = read('scripts/lib/repo-bootstrap.mjs');
assert.match(bootstrap, /pr-bot-feedback-check\.yml/);
assert.doesNotMatch(bootstrap, /cursor-auto-pr-review\.yml/);
assert.doesNotMatch(bootstrap, /gemini-review\.yml/);
assert.doesNotMatch(bootstrap, /qwen-pr-review\.mjs/);

console.log('review gate policy verification passed');
