/**
 * Detect PRs that only change generated artifacts under configurable path prefixes.
 * Bot wait / thread gates may skip these (paths-ignore left required checks stale).
 *
 * Override: AR_PR_GATE_EXEMPT_PREFIXES (comma-separated paths, default reports/)
 */
import { ghJson } from './gh-pr-review-threads.mjs';

/** @returns {string[]} */
export function gateExemptPrefixes() {
  const raw = process.env.AR_PR_GATE_EXEMPT_PREFIXES?.trim();
  if (raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return ['reports/'];
}

export function isReportsOnlyPath(filePath) {
  const p = String(filePath || '');
  return gateExemptPrefixes().some((prefix) => p.startsWith(prefix));
}

export function isReportsOnlyFileList(files) {
  if (!Array.isArray(files) || files.length === 0) return false;
  return files.every((entry) => {
    const path = typeof entry === 'string' ? entry : entry?.path || '';
    return isReportsOnlyPath(path);
  });
}

export function fetchPrChangedPaths(prNumber) {
  const view = ghJson(['pr', 'view', String(prNumber), '--json', 'files']);
  return (view.files || []).map((f) => f.path);
}

export function isReportsOnlyPr(prNumber) {
  return isReportsOnlyFileList(fetchPrChangedPaths(prNumber));
}
