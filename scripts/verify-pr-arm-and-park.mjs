#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  classifyGateFailure,
  classifyPostProgressState,
  classifyWorkMode,
  progressionAutoMergeSucceeded,
  progressionFailureDetail,
} from './lib/pr-arm-and-park-lib.mjs';
import { shouldMarkReady } from './lib/pr-branch-sync.mjs';
import { evaluateDefaultBase } from './lib/pr-base-guard.mjs';
import {
  fetchRequiredCi,
  gateShipCloseoutSubgates,
} from './lib/pr-gates-lib.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

assert.equal(evaluateDefaultBase('main', 'main').covered, true);
assert.equal(evaluateDefaultBase('feature/base', 'main').covered, false);
assert.equal(evaluateDefaultBase('main', null).covered, false);
assert.equal(
  classifyGateFailure({ id: 'ci-required', pass: false, detail: 'pending' }),
  'waiting',
);
assert.equal(
  classifyGateFailure({
    id: 'ci-required',
    pass: false,
    pending: true,
    detail: 'Required checks have not reported on the current head yet',
  }),
  'waiting',
);
assert.equal(
  classifyGateFailure({ id: 'ci-required', pass: false, detail: 'Failed: test' }),
  'actionable',
);
assert.equal(
  classifyGateFailure({ id: 'pr-bot-feedback-check', pass: false }),
  'actionable',
);
assert.equal(
  classifyGateFailure({ id: 'ship-closeout-subgates', pass: false, exitCode: 2 }),
  'waiting',
);
assert.equal(
  classifyGateFailure({ id: 'ship-closeout-subgates', pass: false, exitCode: 1 }),
  'actionable',
);
assert.equal(
  gateShipCloseoutSubgates(
    { pass: false, exitCode: 2 },
    { pass: true, exitCode: 0 },
  ).exitCode,
  2,
);
assert.equal(
  classifyWorkMode({
    gates: [{ id: 'ci-required', pass: false, detail: 'pending' }],
  }).mode,
  'waiting',
);
assert.equal(
  classifyWorkMode({
    gates: [
      { id: 'ci-required', pass: false, detail: 'pending' },
      { id: 'pr-bot-feedback-check', pass: false },
    ],
  }).mode,
  'actionable',
);
assert.equal(classifyPostProgressState({ state: 'OPEN' }, 7), null);
assert.equal(shouldMarkReady({ state: 'OPEN', isDraft: true }), false);
assert.equal(shouldMarkReady({ state: 'OPEN', isDraft: true }, true), true);
assert.equal(shouldMarkReady({ state: 'OPEN', isDraft: false }, true), false);
assert.equal(shouldMarkReady({ state: 'MERGED', isDraft: true }, true), false);
assert.equal(
  progressionFailureDetail({
    ready: { detail: 'gh pr ready failed: auth denied' },
    sync: null,
  }),
  'gh pr ready failed: auth denied',
);
assert.equal(progressionAutoMergeSucceeded(null), false);
assert.equal(progressionAutoMergeSucceeded({ autoMerge: { ok: true } }), true);
assert.match(
  fetchRequiredCi.toString(),
  /fetchRequiredCheckState/,
  'required checks must be evaluated against the exact current PR head',
);
assert.deepEqual(
  classifyPostProgressState({ state: 'MERGED' }, 7),
  {
    mode: 'ready',
    merged: true,
    classification: {
      mode: 'ready',
      actionable: [],
      waiting: [],
      gates: [{
        id: 'terminal-state',
        pass: true,
        detail: 'PR #7 merged while auto-merge was being armed',
      }],
    },
  },
);
assert.equal(classifyPostProgressState({ state: 'CLOSED' }, 7).mode, 'actionable');
const armSource = readFileSync(join(root, 'scripts', 'lib', 'pr-arm-and-park-lib.mjs'), 'utf8');
assert.match(
  armSource,
  /const gates = evaluateGates\(prNumber\);[\s\S]*fetchPrMergeMeta\(prNumber, \{ requireOpen: false \}\)[\s\S]*classifyPostProgressState\(refreshed, prNumber\)/,
);
assert.match(armSource, /!opts\.dryRun[\s\S]*progressionAutoMergeSucceeded/);

console.log('pr arm-and-park verification passed');
