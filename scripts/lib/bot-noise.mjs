/**
 * Shared classifier for bot comment bodies that should NOT keep the merge
 * gates open. Two consumers:
 *
 *   - wait_for_bots.mjs ignores noise events when computing the quiet window,
 *     so a chatty bot looping on quota errors can't hold the cap timeout open.
 *   - scripts/lib/gh-pr-review-threads.mjs treats noise threads as low-signal
 *     in classifyThreads, so an "out of credits" review thread can't fail the
 *     feedback gate just because nobody resolved it.
 *
 * Two categories:
 *
 *   - Quota / rate-limit notices ("we hit the API limit, try later").
 *   - Trivial inconsequential replies (ack-only / emoji-only / generic
 *     "useful?" footers) â€” these never carry actionable feedback.
 *
 * The bodies that prompted this filter were:
 *   - "Your <bot> trial has expired" / "subscription required" / "out of credits"
 *   - "Sorry, I couldn't review this PR â€” rate limit"
 *   - "Useful? React with ðŸ‘ / ðŸ‘Ž" tail-only summary stubs
 *   - Single-emoji or "lgtm" replies
 */

const QUOTA_PATTERNS = [
  /^\s*(?:>\s*)?(?:#{1,6}\s*)?(?:review )?rate[ -]limit(?:ed| reached| exceeded)?[.!\s]*$/im,
  /(?:couldn.t|cannot|unable to|failed to)\s+(?:review|process|complete)\b/i,
  /\b(?:your|our|we(?:.ve| have) (?:hit|reached))\b[^\n]{0,70}\b(?:quota|limit|credits|trial)\b/i,
  /^\s*(?:ERROR:|Review outcome:\s*failed\b)/im,
  /\breview activity has ceased\b/i,
  /\bconsumer version (?:has been )?(?:sunset|retired|deprecated)\b/i,
  /\bdid not complete successfully\b/i,
];

const TRIVIAL_PATTERNS = [
  // Ack/no-op replies (the whole body, modulo whitespace and trailing puncts).
  /^[\s]*(?:lgtm|looks good(?:\s+to\s+me)?|ok|okay|got it|thanks?|thx|noted|nothing to (?:report|add)|no (?:comments?|issues?|concerns?)|all good|approved)[\s.!]*$/i,
  // Emoji-only / reaction-only.
  /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}â€ðŸ‘ðŸ‘Žâ¤ï¸âœ…ðŸš€]+$/u,
];

/**
 * @param {string} bodyRaw
 * @returns {boolean}
 */
export function isQuotaBotMessage(bodyRaw) {
  if (!bodyRaw) return false;
  const body = String(bodyRaw).trim();
  if (!body) return false;
  if (/^Review outcome:\s*(?:completed|no findings|findings)\s*$/im.test(body)) return false;
  return QUOTA_PATTERNS.some((re) => re.test(body));
}

/**
 * @param {string} bodyRaw
 * @returns {boolean}
 */
export function isTrivialBotMessage(bodyRaw) {
  if (!bodyRaw) return true;
  const body = String(bodyRaw).trim();
  if (!body) return true;
  // "Useful? React with..." is a footer template. Strip it and re-check whether
  // anything substantive remains â€” bodies whose ONLY content is the footer get
  // dropped, but a real review with a footer tacked on stays.
  const withoutFooter = body.replace(/Useful\?\s*React with[\s\S]*$/i, '').trim();
  if (!withoutFooter) return true;
  return TRIVIAL_PATTERNS.some((re) => re.test(withoutFooter));
}

/**
 * True when a bot comment body should not hold the merge gates open â€”
 * either it's a quota / API-limit notice, or a trivial inconsequential reply.
 *
 * @param {string} bodyRaw
 * @returns {boolean}
 */
export function isBotNoise(bodyRaw) {
  return isQuotaBotMessage(bodyRaw) || isTrivialBotMessage(bodyRaw);
}


