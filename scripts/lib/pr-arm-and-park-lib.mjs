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
    return gate.pending || /pending/i.test(gate.detail || '') ? 'waiting' : 'actionable';
  }
  if (gate.id === 'github-bot-gates') {
    return /not reported yet|pending|in_progress|queued/i.test(gate.detail || '')
      ? 'waiting'
      : 'actionable';
  }
  if (gate.id === 'wait-for-bots') {
    return gate.exitCode === 2 ? 'waiting' : 'actionable';
  }
  if (gate.id === 'ship-closeout-subgates') {
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

export function classifyPostProgressState(meta, prNumber) {
  if (!meta || meta.state === 'OPEN') return null;
  if (meta.state === 'MERGED') {
    return {
      mode: 'ready',
      merged: true,
      classification: {
        mode: 'ready',
        actionable: [],
        waiting: [],
        gates: [{
          id: 'terminal-state',
          pass: true,
          detail: `PR #${prNumber} merged while auto-merge was being armed`,
        }],
      },
    };
  }
  return {
    mode: 'actionable',
    merged: false,
    classification: {
      mode: 'actionable',
      actionable: [{
        id: 'branch-fresh',
        pass: false,
        detail: `PR #${prNumber} changed state unexpectedly (${meta.state})`,
      }],
      waiting: [],
    },
  };
}

export function progressionFailureDetail(progression) {
  return progression?.ready?.detail
    || progression?.sync?.detail
    || progression?.branchState?.detail
    || 'PR progression failed';
}

export function progressionAutoMergeSucceeded(progression) {
  return progression?.autoMerge?.ok === true;
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

  let progression = null;
  let progressionError = null;
  try {
    progression = progressPullRequest(prNumber, {
      dryRun: Boolean(opts.dryRun),
      syncBranch: !opts.skipSync,
      enableAuto: !opts.skipArm,
      markReady: true,
    });
  } catch (error) {
    progressionError = error;
  }

  let postProgress = null;
  try {
    postProgress = fetchPrMergeMeta(prNumber, { requireOpen: false });
  } catch {
    // Gate evaluation below reports a hard API/auth failure if the PR is still open.
  }
  const terminal = classifyPostProgressState(postProgress, prNumber);
  if (terminal?.merged) {
    return {
      ...terminal,
      progression,
      baseGuard,
      autoMergeArmed: progressionAutoMergeSucceeded(progression),
    };
  }
  if (terminal) {
    return {
      ...terminal,
      progression,
      baseGuard,
      autoMergeArmed: false,
    };
  }
  if (progressionError) {
    return {
      mode: 'error',
      error: progressionError.message,
      progression,
      baseGuard,
      autoMergeArmed: false,
    };
  }
  if (progression?.blocked) {
    const detail = progressionFailureDetail(progression);
    if (progression.hardError) {
      return {
        mode: 'error',
        error: detail,
        progression,
        baseGuard,
        autoMergeArmed: false,
      };
    }
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
          detail,
        }],
        waiting: [],
      },
    };
  }

  const gates = evaluateGates(prNumber);
  const classification = classifyWorkMode(gates);
  let refreshed = postProgress || meta;
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
      isAutoMergeEnabled(refreshed) || progressionAutoMergeSucceeded(progression),
  };
}
