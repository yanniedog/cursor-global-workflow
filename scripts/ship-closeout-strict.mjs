#!/usr/bin/env node
/**
 * Exit 2 when an open PR exists for the current branch (ship closeout guard).
 * Also runs pr-bot-feedback-check when PR number is known.
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
  console.error(
    `ship-closeout-strict: open PR still exists for ${branch} — complete WORKFLOW.md steps 5–9.`,
  );

  if (prNumber) {
    const checkPath = join(scriptsDir(), 'pr-bot-feedback-check.mjs');
    const gate = spawnSync(process.execPath, [checkPath, '--pr', String(prNumber)], {
      stdio: 'inherit',
    });
    if (gate.status === 1) {
      console.error(
        'ship-closeout-strict: bot feedback gate failed — close review threads before merge.',
      );
      process.exit(2);
    }
  }

  process.exit(2);
}

main();
