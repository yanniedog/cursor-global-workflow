#!/usr/bin/env node
/**
 * Resolve gate-exempt reason for a PR (stdout: reason or empty).
 *
 * Env: PR, PR_TITLE, PR_AUTHOR, PR_AUTHOR_TYPE, GH_TOKEN
 */
import { gateExemptReason } from './lib/pr-gate-exempt.mjs';
const pr = process.env.PR?.trim() || '';
if (!/^[1-9][0-9]*$/.test(pr)) throw new Error('PR must be a positive number');
process.stdout.write(gateExemptReason(pr) || '');
