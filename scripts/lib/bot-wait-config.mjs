/**
 * Required-bot aliases for wait-for-bots and pr-bot-feedback-check.
 * Keys are short names (gemini, codex, sourcery, qwen, cursor); values are GitHub logins to match.
 */
import { isQuotaBotMessage, isTrivialBotMessage, looksLikeSubstantiveFinding } from './bot-noise.mjs';

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

// Review vendors are advisory. Merge liveness must not depend on a local
// runner, vendor quota, or an installation outside the repository's control.
export const DEFAULT_REQUIRED_KEYS = [];

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
const GEMINI_ALIAS_KEYS = new Set([
  'gemini',
  'gemini-code-assist',
  'gemini-code-assist[bot]',
  'google-github-actions-bot[bot]',
  'google-github-actions[bot]',
]);

export function isGeminiRequiredKey(key) {
  return GEMINI_ALIAS_KEYS.has(String(key || '').toLowerCase());
}

export function eventSatisfiesRequiredKey(login, body, key, opts = {}) {
  const lower = String(login || '').toLowerCase();
  const k = String(key || '').toLowerCase();
  if (!lower) return false;
  if (isTrivialBotMessage(body) || isReviewerNonsenseFailure(body)) return false;
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

const REVIEWER_NONSENSE_PATTERNS = [
  /^\s*(?:>\s*)?(?:sorry[,!\s-]*)?(?:i |we )?(?:could not|couldn't|cannot|unable to|failed to)\s+review\b/im,
  /^\s*(?:(?:>\s*)?(?:the )?(?:model |reviewer |gemini )?(?:returned|posted|produced|received) an )?empty review\b/im,
];

/** Quota, API errors, empty reviews, and "could not review" notices are not a completed review. */
function isSuccessfulQwenReview(body) {
  return isQwenCodeReviewBody(body)
    && /\bReview outcome:\s*(completed|no findings|findings)\b/i.test(body)
    && !/did not complete successfully|review failed/i.test(body);
}

export function isReviewerNonsenseFailure(bodyRaw) {
  const body = String(bodyRaw ?? '').trim();
  if (!body) return true;
  if (isSuccessfulQwenReview(body) || looksLikeSubstantiveFinding(body)) return false;
  return isQuotaBotMessage(body) || REVIEWER_NONSENSE_PATTERNS.some((pattern) => pattern.test(body));
}

function eventsForRequiredKey(key, events) {
  const normalized = String(key || '').toLowerCase();
  return (events || []).filter((event) => {
    const login = String(event?.login || '');
    const body = event?.body || '';
    if (normalized === 'qwen' || normalized === 'cursor') {
      return login.toLowerCase() === 'github-actions[bot]' && isQwenCodeReviewBody(body);
    }
    if (normalized === 'gemini') {
      if (login.toLowerCase() === 'github-actions[bot]') return isGeminiCodeReviewBody(body);
      return loginMatchesRequiredKey(login, 'gemini');
    }
    return loginMatchesRequiredKey(login, normalized);
  });
}

/** Qwen and the legacy cursor-auto-review key are the same optional reviewer. */
const NEVER_REQUIRED_KEYS = new Set(['qwen', 'cursor', 'github-actions[bot]']);

export function omitNeverRequiredKeys(keys) {
  return (keys || []).filter((key) => !NEVER_REQUIRED_KEYS.has(String(key || '').toLowerCase()));
}

/**
 * Gemini absence, quota, and other non-substantive failures never block.
 * Qwen, including a missing review, never blocks. Codex and Sourcery still
 * block when they have not posted. The same nonsense failure from those
 * reviewers does not block. Substantive Gemini threads stay on the feedback gate.
 */
export function blockingMissingRequiredKeys(missing, events) {
  return (missing || []).filter((key) => {
    const normalized = String(key || '').toLowerCase();
    if (isGeminiRequiredKey(normalized) || NEVER_REQUIRED_KEYS.has(normalized)) return false;
    const related = eventsForRequiredKey(normalized, events)
      .filter((event) => !isTrivialBotMessage(event.body));
    if (related.length === 0) return true;
    return !related.every((event) => isReviewerNonsenseFailure(event.body));
  });
}

export function parseRequiredKeys(raw) {
  if (!raw || !String(raw).trim()) return [...DEFAULT_REQUIRED_KEYS];
  if (/^(off|none|disabled)$/i.test(String(raw).trim())) return [];
  return omitNeverRequiredKeys(
    String(raw)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function resolveRequiredKeys(argvKeys, envRaw) {
  // An explicitly supplied empty list means "off"; do not resurrect a saved
  // or environment policy. Qwen cannot be reintroduced through argv or env.
  if (Array.isArray(argvKeys)) return omitNeverRequiredKeys(argvKeys);
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
  if (!keys.length) return 'none (reviewers advisory)';
  return keys.map((k) => `${k} (${loginsForKey(k).join(' | ')})`).join(', ');
}
