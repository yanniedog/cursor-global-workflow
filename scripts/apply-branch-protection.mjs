#!/usr/bin/env node
/**
 * Apply branch protection while retaining repository CI and requiring the
 * vendor-neutral feedback gate.
 * Requires admin/repo scope on GH_TOKEN or gh auth.
 *
 * Usage: npm run branch-protection:apply [-- --branch main] [-- --dry-run]
 */
import { spawnSync } from 'node:child_process';

/** GitHub Actions job ids — must match workflow YAML job keys exactly. */
const DEFAULT_CHECKS = ['bot-feedback-gate'];
const RETIRED_CHECKS = new Set([
  'bot-presence-gate',
  'qwen-code-review',
  'local-llm-review',
]);

const GH_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const out = { branch: 'main', dryRun: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--branch' && argv[i + 1]) out.branch = argv[++i];
    else if (a.startsWith('--branch=')) out.branch = a.slice('--branch='.length);
  }
  return out;
}

function ghJson(args, { allow404 = false } = {}) {
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
  if (r.error) throw new Error(r.error.message);
  if (r.status !== 0) {
    const message = (r.stderr || r.stdout || '').trim() || `gh exit ${r.status}`;
    if (allow404 && /\b404\b/.test(message)) return null;
    throw new Error(message);
  }
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

function configuredChecks() {
  const raw = process.env.PR_REQUIRED_CHECKS || '';
  const configured = raw.split(',').map((value) => value.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_CHECKS;
}

function desiredContexts(existingContexts) {
  const retained = (existingContexts || []).filter((context) => !RETIRED_CHECKS.has(context));
  return [...new Set([...retained, ...configuredChecks()])];
}

function protectionPayload(existing, contexts) {
  const reviews = existing?.required_pull_request_reviews;
  return {
    required_status_checks: {
      strict: true,
      contexts,
    },
    enforce_admins: existing?.enforce_admins?.enabled ?? true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: reviews?.dismiss_stale_reviews ?? true,
      require_code_owner_reviews: reviews?.require_code_owner_reviews ?? false,
      required_approving_review_count: reviews?.required_approving_review_count ?? 0,
    },
    restrictions: null,
    required_conversation_resolution:
      existing?.required_conversation_resolution?.enabled ?? true,
    allow_force_pushes: existing?.allow_force_pushes?.enabled ?? false,
    allow_deletions: existing?.allow_deletions?.enabled ?? false,
  };
}

function printManualSteps(repo, branch, checks) {
  console.log(`
Branch protection could not be applied via API (token may lack admin:repo scope).

Manual GitHub UI steps for ${repo} → Settings → Branches → Branch protection rules → Add rule:

1. Branch name pattern: \`${branch}\`
2. Require a pull request before merging: ON (no approval count required unless you want human review)
3. Require status checks to pass before merging: ON
   - Require branches to be up to date before merging: ON
   - Required checks (exact job names):
${checks.map((c) => `     - \`${c}\``).join('\n')}
4. Require conversation resolution before merging: ON
5. Do not allow bypassing the above settings (recommended for admins too)

Note: GitHub cannot block "Close pull request" via branch protection. Agents must not close
PRs without merge unless the user waives in writing; \`npm run agent:auditor\` flags
closed-unmerged PRs with open bot threads.
`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: npm run branch-protection:apply [-- --branch main] [-- --dry-run]');
    process.exit(0);
  }

  if (spawnSync('gh', ['--version'], { stdio: 'ignore' }).status !== 0) {
    console.error('apply-branch-protection: install gh CLI and authenticate (gh auth login)');
    process.exit(1);
  }

  let repo;
  try {
    repo = ghJson(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner;
  } catch (e) {
    console.error(`apply-branch-protection: ${e.message}`);
    process.exit(1);
  }

  const path = `repos/${repo}/branches/${args.branch}/protection`;
  let existing;
  try {
    existing = ghJson(['api', path], { allow404: true });
  } catch (e) {
    console.error(`apply-branch-protection: could not read existing protection: ${e.message}`);
    process.exit(1);
  }
  const checks = desiredContexts(existing?.required_status_checks?.contexts);
  const payload = protectionPayload(existing, checks);

  if (args.dryRun) {
    console.log(JSON.stringify({ repo, branch: args.branch, checks, payload }, null, 2));
    process.exit(0);
  }

  const r = spawnSync(
    'gh',
    ['api', '--method', 'PUT', path, '--input', '-'],
    { encoding: 'utf8', input: JSON.stringify(payload), timeout: GH_TIMEOUT_MS },
  );
  if (r.status === 0) {
    console.log(`Branch protection applied on ${repo}:${args.branch}`);
    console.log(`Required checks: ${checks.join(', ')}`);
    console.log(`Retired checks removed: ${[...RETIRED_CHECKS].join(', ')}`);
    console.log(`required_conversation_resolution: ${payload.required_conversation_resolution}`);
    process.exit(0);
  }

  console.error(`apply-branch-protection: API failed (exit ${r.status})`);
  if (r.stderr) console.error(r.stderr.trim());
  printManualSteps(repo, args.branch, checks);
  process.exit(r.status === 403 || r.status === 404 ? 2 : 1);
}

main();
