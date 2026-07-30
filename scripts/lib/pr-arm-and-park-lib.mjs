import { evaluateGates } from './pr-gates-lib.mjs';
import { checkDefaultBase, BASE_GUARD_GATE_ID } from './pr-base-guard.mjs';
import {
  fetchPrMergeMeta,
  isAutoMergeEnabled,
  progressPullRequest,
} from './pr-branch-sync.mjs';

const ALWAYS_ACTIONABLE = new Set([
  'gh-auth',
  'branch-fresh',
  'auto-merge',
  'pr-bot-feedback-check',
  BASE_GUARD_GATE_ID,
]);

export function classifyGateFailure(gate) {
  if (!gate || gate.pass) return 'ok';
  if (ALWAYS_ACTIONABLE.has(gate.id)) return 'actionable';
  if (gate.id === 'ci-required') {
    return /pending/i.test(gate.detail || '') ? 'waiting' : 'actionable';
  }
  if (gate.id === 'github-bot-gates') {
    return /not reported yet|pending|in_progress|queued/i.test(gate.detail || '')
      ? 'waiting'
      : 'actionable';
  }
  if (gate.id === 'wait-for-bots') {
    return gate.exitCode === 2 ? 'waiting' : 'actionable';
  }
  return 'actionable';
}

export function classifyWorkMode(gatesResult) {
  const failing = (gatesResult.gates || []).filter((gate) => !gate.pass);
  const actionable = failing.filter((gate) => classifyGateFailure(gate) === 'actionable');
  const waiting = failing.filter((gate) => classifyGateFailure(gate) === 'waiting');
  const mode = actionable.length ? 'actionable' : waiting.length ? 'waiting' : 'ready';
  return { mode, actionable, waiting, gates: gatesResult.gates || [] };
}

export function armAndParkOnce(prNumber, opts = {}) {
  let meta;
  try {
    meta = fetchPrMergeMeta(prNumber);
  } catch (error) {
    return { mode: 'error', error: error.message, autoMergeArmed: false };
  }

  const baseGuard = opts.baseGuard ?? checkDefaultBase(meta.baseRefName);
  if (!baseGuard.covered) {
    return {
      mode: 'actionable',
      autoMergeArmed: false,
      baseGuard,
      classification: {
        mode: 'actionable',
        actionable: [{ id: BASE_GUARD_GATE_ID, pass: false, detail: baseGuard.detail }],
        waiting: [],
      },
    };
  }

  const progression = progressPullRequest(prNumber, {
    dryRun: Boolean(opts.dryRun),
    syncBranch: !opts.skipSync,
    enableAuto: !opts.skipArm,
  });
  if (progression.blocked) {
    return {
      mode: 'actionable',
      progression,
      baseGuard,
      autoMergeArmed: false,
      classification: {
        mode: 'actionable',
        actionable: [{
          id: 'branch-fresh',
          pass: false,
          detail: progression.sync?.detail || progression.branchState?.detail,
        }],
        waiting: [],
      },
    };
  }

  const gates = evaluateGates(prNumber);
  const classification = classifyWorkMode(gates);
  let refreshed = meta;
  try {
    refreshed = fetchPrMergeMeta(prNumber);
  } catch {
    // The progression result still proves whether the arm command succeeded.
  }
  return {
    mode: classification.mode,
    progression,
    gates,
    classification,
    baseGuard,
    autoMergeArmed:
      isAutoMergeEnabled(refreshed) || progression.autoMerge?.ok === true,
  };
}
