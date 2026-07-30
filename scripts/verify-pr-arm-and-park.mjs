#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  classifyGateFailure,
  classifyPostProgressState,
  classifyWorkMode,
} from './lib/pr-arm-and-park-lib.mjs';
import { evaluateDefaultBase } from './lib/pr-base-guard.mjs';

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
