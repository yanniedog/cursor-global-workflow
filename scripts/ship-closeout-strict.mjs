#!/usr/bin/env node
/**
 * Exit 2 when an open PR exists for the current branch (ship closeout guard).
 * Runs wait-for-bots and pr-bot-feedback-check when PR number is known.
 */
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function scriptsDir() {
  return process.env.CURSOR_WORKFLOW_SCRIPTS || __dirname;
}

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return (e.stdout || e.stderr || '').trim();
  }
}

function main() {
  let branch;
  try {
    branch = sh('git rev-parse --abbrev-ref HEAD');
  } catch {
    console.error('ship-closeout-strict: git not available or not a repo');
    process.exit(1);
  }

  if (!branch || branch === 'main') {
    const closeLoopPath = join(scriptsDir(), 'close-loop-check.mjs');
    const loop = spawnSync(process.execPath, [closeLoopPath, '--post-merge-gap'], {
      stdio: 'inherit',
    });
    if (loop.status === 1) {
      console.error(
        'ship-closeout-strict: post-merge gap detected — run npm run close-loop:check -- --post-merge-gap',
      );
      process.exit(1);
    }
    if (loop.status != null && loop.status !== 0) {
      console.error('ship-closeout-strict: close-loop-check failed');
      process.exit(loop.status || 1);
    }
    process.exit(0);
  }

  let prList;
  try {
    prList = sh(`gh pr list --head ${branch} --json number`);
  } catch {
    console.log('(Install gh CLI for ship closeout checks.)');
    process.exit(0);
  }

  if (!prList) {
    console.error('ship-closeout-strict: gh pr list failed');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(prList || '[]');
  } catch {
    console.error('ship-closeout-strict: invalid gh JSON');
    process.exit(1);
  }

  if (!data.length) {
    process.exit(0);
  }

  const prNumber = data[0]?.number;
  const dir = scriptsDir();
  console.error(
    `ship-closeout-strict: open PR still exists for ${branch} — complete WORKFLOW.md steps 5–9.`,
  );

  if (prNumber) {
    const waitPath = join(dir, 'wait_for_bots.mjs');
    const wait = spawnSync(process.execPath, [waitPath, '--pr', String(prNumber)], {
      stdio: 'inherit',
    });
    if (wait.status === 2) {
      console.error(
        'ship-closeout-strict: bot wait not satisfied — run npm run wait-for-bots until exit 0.',
      );
      process.exit(2);
    }
    if (wait.status === 1) {
      console.error(
        'ship-closeout-strict: bot wait failed (required bots missing or error) — do not merge.',
      );
      process.exit(2);
    }

    const checkPath = join(dir, 'pr-bot-feedback-check.mjs');
    const gate = spawnSync(process.execPath, [checkPath, '--pr', String(prNumber)], {
      stdio: 'inherit',
    });
    if (gate.status === 1) {
      console.error(
        'ship-closeout-strict: bot feedback gate failed — wait for required bots and close review threads before merge.',
      );
      process.exit(2);
    }
  }

  process.exit(2);
}

main();
