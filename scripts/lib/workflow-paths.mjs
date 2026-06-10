/**
 * Resolve workflow script install dir and consumer git repo root.
 * Scripts run from CURSOR_WORKFLOW_SCRIPTS (~/.cursor/workflow-scripts) with cwd = project repo.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @returns {string} */
export function scriptsDir() {
  const fromEnv = process.env.CURSOR_WORKFLOW_SCRIPTS?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(__dirname, '..');
}

/** @returns {string} */
export function gitRepoRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return (r.stdout || '').trim() || process.cwd();
}

/**
 * @param {string} scriptName basename under scriptsDir (e.g. wait_for_bots.mjs)
 * @param {string[]} [extraArgs]
 * @param {{ cwd?: string, env?: object, maxBuffer?: number, timeout?: number }} [opts]
 */
export function runWorkflowScript(scriptName, extraArgs = [], opts = {}) {
  const script = path.join(scriptsDir(), scriptName);
  const r = spawnSync(process.execPath, [script, ...extraArgs], {
    cwd: opts.cwd || gitRepoRoot(),
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
    maxBuffer: opts.maxBuffer || 1024 * 1024,
    timeout: opts.timeout || 120_000,
  });
  return {
    exitCode: r.status ?? 1,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}
