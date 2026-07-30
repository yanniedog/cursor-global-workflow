#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  classifyGateFailure,
  classifyPostProgressState,
  classifyWorkMode,
} from './lib/pr-arm-and-park-lib.mjs';
import { shouldMarkReady } from './lib/pr-branch-sync.mjs';
import { evaluateDefaultBase } from './lib/pr-base-guard.mjs';
import { gateShipCloseoutSubgates } from './lib/pr-gates-lib.mjs';

assert.equal(evaluateDefaultBase('main', 'main').covered, true);
assert.equal(evaluateDefaultBase('feature/base', 'main').covered, false);
assert.equal(evaluateDefaultBase('main', null).covered, false);
assert.equal(
  classifyGateFailure({ id: 'ci-required', pass: false, detail: 'pending' }),
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
assert.equal(shouldMarkReady({ state: 'OPEN', isDraft: true }), true);
assert.equal(shouldMarkReady({ state: 'OPEN', isDraft: false }), false);
assert.equal(shouldMarkReady({ state: 'MERGED', isDraft: true }), false);
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

console.log('pr arm-and-park verification passed');
