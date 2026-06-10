import fs from 'node:fs';
import path from 'node:path';
import { gitRepoRoot } from './workflow-paths.mjs';

/**
 * Directory for per-PR bot-wait anchor JSON (portable across linked worktrees).
 * Override: AR_BOT_WAIT_STATE_DIR (absolute, or repo-relative).
 * Default: <repo>/.ar-bot-wait (not under .git).
 */
export function botWaitStateDir(repoRoot) {
  const env = process.env.AR_BOT_WAIT_STATE_DIR?.trim();
  const root = repoRoot || gitRepoRoot();
  if (env) {
    return path.isAbsolute(env) ? path.resolve(env) : path.resolve(root, env);
  }
  return path.join(root, '.ar-bot-wait');
}

/** @param {number} prNumber @param {string} [repoRoot] */
export function botWaitStatePath(prNumber, repoRoot) {
  return path.join(botWaitStateDir(repoRoot), `${prNumber}.json`);
}

/** Legacy path under .git (read-only fallback). */
export function legacyBotWaitStatePath(prNumber, repoRoot) {
  const root = repoRoot || gitRepoRoot();
  return path.join(root, '.git', 'ar-bot-wait', `${prNumber}.json`);
}

/**
 * @param {number} prNumber
 * @param {string} [repoRoot]
 * @returns {object | null}
 */
export function readBotWaitStateFile(prNumber, repoRoot) {
  const candidates = [botWaitStatePath(prNumber, repoRoot)];
  if (!process.env.AR_BOT_WAIT_STATE_DIR?.trim()) {
    candidates.push(legacyBotWaitStatePath(prNumber, repoRoot));
  }
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * @param {number} prNumber
 * @param {object} state
 * @param {string} [repoRoot]
 */
export function writeBotWaitStateFile(prNumber, state, repoRoot) {
  const p = botWaitStatePath(prNumber, repoRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}
