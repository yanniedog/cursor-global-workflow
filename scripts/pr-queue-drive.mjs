#!/usr/bin/env node
/** Drive open PR queue: oldest-first sync + auto-merge + gates. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { evaluateGates } from './lib/pr-gates-lib.mjs';
import { progressPullRequest } from './lib/pr-branch-sync.mjs';
import { hasGh, ghJson } from './lib/gh-pr-review-threads.mjs';
import { isGateExemptPr } from './lib/pr-gate-exempt.mjs';
import { gitRepoRoot, scriptsDir } from './lib/workflow-paths.mjs';

function main() {
  try {
    const parallelWait = process.argv.includes('--parallel-wait');
    const noProgress = process.argv.includes('--no-progress');
    if (!hasGh()) {
      console.error('pr-queue-drive: gh required');
      process.exit(1);
    }

    const prs = ghJson(['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,createdAt', '--limit', '100']);
    const sorted = (Array.isArray(prs) ? prs : []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (!sorted.length) {
      console.log('pr-queue-drive: idle');
      process.exit(0);
    }

    console.log(`pr-queue-drive: ${sorted.length} PR(s) oldest-first`);
    if (parallelWait) {
      const waitScript = path.join(scriptsDir(), 'wait_for_bots.mjs');
      const cwd = gitRepoRoot();
      for (const pr of sorted) {
        try {
          if (isGateExemptPr(pr.number)) continue;
          const c = spawn(process.execPath, [waitScript, '--pr', String(pr.number)], {
            cwd,
            detached: true,
            stdio: 'ignore',
          });
          c.unref();
        } catch {
          /* skip */
        }
      }
    }

    const results = [];
    for (const pr of sorted) {
      console.log(`#${pr.number} ${pr.title}`);
      if (!noProgress) {
        try {
          const p = progressPullRequest(pr.number);
          if (p.sync) console.log(`  sync ${p.sync.action}: ${p.sync.detail}`);
          if (p.autoMerge) console.log(`  auto-merge ${p.autoMerge.action}: ${p.autoMerge.detail}`);
        } catch (e) {
          console.error(`  progression: ${e.message}`);
        }
      }
      const gates = evaluateGates(pr.number);
      const failing = gates.gates.filter((g) => !g.pass).map((g) => g.id);
      results.push({ number: pr.number, gatesPass: gates.pass, failingGates: failing });
      console.log(gates.pass ? '  gates: pass' : `  gates: fail (${failing.join(', ')})`);
    }
    process.exit(results.every((r) => r.gatesPass) ? 0 : 2);
  } catch (e) {
    console.error(`pr-queue-drive: ${e.message}`);
    process.exit(1);
  }
}
main();
