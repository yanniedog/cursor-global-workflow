/**
 * Required-bot aliases for wait-for-bots and pr-bot-feedback-check.
 * Keys are short names (gemini, codex, sourcery, qwen, cursor); values are GitHub logins to match.
 */
import { isQuotaBotMessage } from './bot-noise.mjs';

export const BOT_ALIASES = {
  gemini: [
    'gemini-code-assist',
    'gemini-code-assist[bot]',
    'google-github-actions-bot[bot]',
    'google-github-actions[bot]',
    // sshnaidm/gemini-code-review-action posts as github-actions[bot]
    // (matched via isGeminiCodeReviewBody, not bare login).
    'github-actions[bot]',
  ],
  codex: ['chatgpt-codex-connector', 'chatgpt-codex-connector[bot]'],
  sourcery: ['sourcery-ai', 'sourcery-ai[bot]'],
  qwen: ['github-actions[bot]'],
  cursor: ['github-actions[bot]'],
};

export const DEFAULT_REQUIRED_KEYS = ['gemini', 'codex', 'sourcery', 'qwen'];

export const OPTIONAL_BOT_LOGINS = [
  'github-actions[bot]',
  'copilot-pull-request-reviewer[bot]',
  'coderabbitai',
  'coderabbitai[bot]',
  'greptile-apps[bot]',
];

export function isQwenCodeReviewBody(bodyRaw) {
  return /<!--\s*(qwen-code-review|cursor-auto-review)\s*-->/i.test(String(bodyRaw || ''));
}

export function reviewedCommitFromBody(bodyRaw) {
  return String(bodyRaw || '').match(/\bReviewed commit:\s*`?([0-9a-f]{7,40})`?/i)?.[1]?.toLowerCase() || null;
}

export function isGeminiCodeReviewBody(bodyRaw) {
  const body = String(bodyRaw || '');
  return (
    /<!--\s*gemini-code-review\s*-->/i.test(body) ||
    /#\s*Code Review by Gemini/i.test(body) ||
    /\bCode Review by Gemini\b/i.test(body)
  );
}

/** @deprecated Use isQwenCodeReviewBody — accepts legacy cursor-auto-review marker too. */
export function isCursorAutoReviewBody(bodyRaw) {
  return isQwenCodeReviewBody(bodyRaw);
}

/**
 * Body-aware match so github-actions[bot] Qwen vs Gemini reviews do not
 * satisfy each other's required keys.
 */
export function eventSatisfiesRequiredKey(login, body, key, opts = {}) {
  const lower = String(login || '').toLowerCase();
  const k = String(key || '').toLowerCase();
  if (!lower) return false;
  if (isQuotaBotMessage(body)) return false;
  if (k === 'qwen' || k === 'cursor') {
    const markerMatches =
      lower === 'github-actions[bot]' &&
      isQwenCodeReviewBody(body) &&
      /\bReview outcome:\s*(completed|no findings|findings)\b/i.test(String(body || '')) &&
      !/did not complete successfully|review failed/i.test(String(body || ''));
    if (!markerMatches) return false;
    if (!opts.expectedHeadSha) return true;
    const reviewed = reviewedCommitFromBody(body);
    const expected = String(opts.expectedHeadSha).toLowerCase();
    return Boolean(reviewed && (reviewed === expected || expected.startsWith(reviewed)));
  }
  if (k === 'gemini') {
    if (lower === 'github-actions[bot]') {
      return isGeminiCodeReviewBody(body) && !/^\s*ERROR:/i.test(String(body || ''));
    }
    return loginMatchesRequiredKey(login, 'gemini');
  }
  return loginMatchesRequiredKey(login, key);
}

export function missingRequiredKeysFromEvents(requiredKeys, events, opts = {}) {
  return (requiredKeys || []).filter(
    (key) => !(events || []).some((e) => eventSatisfiesRequiredKey(e.login, e.body, key, opts)),
  );
}

export function parseRequiredKeys(raw) {
  if (!raw || !String(raw).trim()) return [...DEFAULT_REQUIRED_KEYS];
  return String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveRequiredKeys(argvKeys, envRaw) {
  if (argvKeys?.length) return argvKeys;
  const fromEnv = envRaw ?? process.env.AR_BOT_WAIT_REQUIRED ?? process.env.BOT_WAIT_REQUIRED ?? '';
  return parseRequiredKeys(fromEnv);
}

export function loginsForKey(key) {
  const k = key.toLowerCase();
  if (BOT_ALIASES[k]) return BOT_ALIASES[k];
  if (k.includes('[') || k.includes('-')) return [key];
  return [key];
}

export function allKnownBotLogins(requiredKeys) {
  const set = new Set();
  for (const key of requiredKeys) {
    for (const login of loginsForKey(key)) set.add(login.toLowerCase());
  }
  for (const login of OPTIONAL_BOT_LOGINS) set.add(login.toLowerCase());
  return set;
}

export function loginMatchesRequiredKey(login, key) {
  if (!login) return false;
  const lower = login.toLowerCase();
  return loginsForKey(key).some((alias) => lower === alias.toLowerCase());
}

export function missingRequiredKeys(requiredKeys, seenLogins) {
  const seen = [...(seenLogins || [])];
  return requiredKeys.filter(
    (key) => !seen.some((login) => loginMatchesRequiredKey(login, key)),
  );
}

export function formatRequiredKeys(keys) {
  return keys.map((k) => `${k} (${loginsForKey(k).join(' | ')})`).join(', ');
}
