/**
 * PRs that skip bot-feedback-gate and local settlement checks.
 * Default: generated matrix artifacts under reports/ (override via AR_PR_GATE_EXEMPT_PREFIXES).
 */
import { isReportsOnlyFileList, isReportsOnlyPr } from './pr-reports-only.mjs';

export { isReportsOnlyPr };

/**
 * @param {string[]|object[]} files
 * @returns {boolean}
 */
export function isGateExemptFileList(files) {
  return isReportsOnlyFileList(files);
}

/**
 * @param {number|string} prNumber
 * @returns {boolean}
 */
export function isGateExemptPr(prNumber) {
  return isReportsOnlyPr(prNumber);
}

/**
 * @param {number|string} prNumber
 * @returns {'reports'|null}
 */
export function gateExemptReason(prNumber) {
  if (isReportsOnlyPr(prNumber)) return 'reports';
  return null;
}
