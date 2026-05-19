#!/usr/bin/env node
/**
 * User-global Cursor hook: bootstrap workspace on sessionStart (and CLI).
 * Reads optional JSON stdin (sessionStart). Fail-open (exit 0).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bootstrapRepo } from './lib/repo-bootstrap.mjs';

function readStdinJson() {
  try {
    if (process.stdin.isTTY) return null;
    const raw = readFileSync(0, 'utf8').trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function workspaceFromInput(input) {
  if (!input || typeof input !== 'object') return process.cwd();
  return (
    input.workspace_root ||
    input.workspaceRoot ||
    input.root ||
    input.project_path ||
    input.projectPath ||
    (Array.isArray(input.workspace_roots) && input.workspace_roots[0]) ||
    (Array.isArray(input.workspaceRoots) && input.workspaceRoots[0]) ||
    process.cwd()
  );
}

function parseArgs(argv) {
  const out = { workspace: null, batchRoot: null, dryRun: false, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--workspace' && argv[i + 1]) {
      out.workspace = argv[++i];
    } else if (a === '--batch-root' && argv[i + 1]) {
      out.batchRoot = argv[++i];
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--json') {
      out.json = true;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  let results = [];

  if (args.batchRoot) {
    for (const name of readdirSync(args.batchRoot)) {
      const dir = join(args.batchRoot, name);
      try {
        if (!statSync(dir).isDirectory()) continue;
        if (!statSync(join(dir, '.git')).isDirectory()) continue;
      } catch {
        continue;
      }
      results.push(bootstrapRepo(dir, { dryRun: args.dryRun }));
    }
  } else {
    const workspace =
      args.workspace || workspaceFromInput(readStdinJson()) || process.cwd();
    results.push(bootstrapRepo(workspace, { dryRun: args.dryRun }));
  }

  if (args.json || args.batchRoot) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('{}');
  }
}

main();
