#!/usr/bin/env node
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const out = {
    owner: 'yanniedog',
    visibility: 'private',
    codeRoot: process.env.CODE_ROOT || 'C:\\code',
    description: '',
    setupCommand: '',
    verifyCommand: '',
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--name' && argv[i + 1]) out.name = argv[++i];
    else if (arg === '--owner' && argv[i + 1]) out.owner = argv[++i];
    else if (arg === '--description' && argv[i + 1]) out.description = argv[++i];
    else if (arg === '--code-root' && argv[i + 1]) out.codeRoot = argv[++i];
    else if (arg === '--setup-command' && argv[i + 1]) out.setupCommand = argv[++i];
    else if (arg === '--verify-command' && argv[i + 1]) out.verifyCommand = argv[++i];
    else if (arg === '--public') out.visibility = 'public';
    else if (arg === '--private') out.visibility = 'private';
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture
      ? 'pipe'
      : options.input !== undefined
        ? ['pipe', 'inherit', 'inherit']
        : 'inherit',
    cwd: options.cwd,
    env: options.env || process.env,
    input: options.input,
  });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return (result.stdout || '').trim();
}

function workflow(setupCommand, verifyCommand) {
  const setup = setupCommand
    ? `      - name: Setup\n        run: ${JSON.stringify(setupCommand)}\n`
    : '';
  return `name: ci

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  repo-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          persist-credentials: false
${setup}      - name: Verify
        run: ${JSON.stringify(verifyCommand)}
`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: npm run repo:create:standard -- --name <repo> --verify-command <command>
  [--setup-command <command>] [--public|--private] [--description <text>]
  [--owner yanniedog] [--code-root C:\\code] [--dry-run]

Creates the initial main branch, installs repo-ci + bot-feedback-gate and safe
PR tooling, then applies strict protection, squash-only auto-merge settings,
read-only Actions permissions, and advisory-reviewer variables.`);
    process.exit(0);
  }
  if (!args.name || !/^[A-Za-z0-9._-]+$/.test(args.name)) {
    throw new Error('--name is required and must be a valid repository name');
  }
  if (!args.verifyCommand) {
    throw new Error('--verify-command is required so the new repository has deterministic CI');
  }

  const target = resolve(args.codeRoot, args.name);
  const codeRoot = resolve(args.codeRoot);
  if (dirname(target) !== codeRoot) throw new Error('target must be a direct child of --code-root');
  if (existsSync(target)) throw new Error(`target already exists: ${target}`);
  const repo = `${args.owner}/${args.name}`;
  const plan = {
    repo,
    target,
    visibility: args.visibility,
    requiredChecks: ['repo-ci', 'bot-feedback-gate'],
    verifyCommand: args.verifyCommand,
  };
  if (args.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  mkdirSync(join(target, '.github', 'workflows'), { recursive: true });
  mkdirSync(join(target, '.cursor', 'rules'), { recursive: true });
  mkdirSync(join(target, 'scripts', 'lib'), { recursive: true });

  const agentTemplate = readFileSync(join(root, 'templates', 'AGENTS.md'), 'utf8')
    .replaceAll('{PROJECT_NAME}', args.name)
    .replaceAll('{VERIFY_COMMAND}', args.verifyCommand);
  writeFileSync(join(target, 'AGENTS.md'), agentTemplate, 'utf8');
  writeFileSync(
    join(target, '.github', 'workflows', 'ci.yml'),
    workflow(args.setupCommand, args.verifyCommand),
    'utf8',
  );
  copyFileSync(
    join(root, 'templates', '.github', 'workflows', 'pr-bot-feedback-check.yml'),
    join(target, '.github', 'workflows', 'pr-bot-feedback-check.yml'),
  );
  copyFileSync(
    join(root, 'templates', '00-use-global-workflow.mdc'),
    join(target, '.cursor', 'rules', '00-use-global-workflow.mdc'),
  );
  const workflowPolicy = readFileSync(join(root, 'templates', 'WORKFLOW.md'), 'utf8')
    .replaceAll('{PROJECT_NAME}', args.name)
    .replaceAll('{VERIFY_COMMAND}', args.verifyCommand)
    .replaceAll('{DEPLOY_COMMAND}', 'Not configured')
    .replaceAll('{DEPLOY_URL}', 'Not configured');
  writeFileSync(join(target, 'WORKFLOW.md'), workflowPolicy, 'utf8');

  for (const rel of [
    'pr-arm-and-park.mjs',
    'pr-bot-feedback-check.mjs',
    'pr-gates-check.mjs',
    'pr-merge.mjs',
    'wait_for_bots.mjs',
    'apply-branch-protection.mjs',
    'apply-repo-merge-settings.mjs',
  ]) {
    copyFileSync(join(root, 'scripts', rel), join(target, 'scripts', rel));
  }
  cpSync(join(root, 'scripts', 'lib'), join(target, 'scripts', 'lib'), {
    recursive: true,
    filter: (source) => !source.endsWith('repo-bootstrap.mjs'),
  });

  const packageJson = {
    name: args.name.toLowerCase(),
    private: true,
    type: 'module',
    scripts: {
      test: 'node --test',
      'wait-for-bots': 'node scripts/wait_for_bots.mjs',
      'pr:bot-feedback-check': 'node scripts/pr-bot-feedback-check.mjs',
      'pr:bot-feedback-audit':
        'node scripts/pr-bot-feedback-check.mjs --audit-merged --limit 20',
      'pr:gates:check': 'node scripts/pr-gates-check.mjs',
      'pr:arm-and-park': 'node scripts/pr-arm-and-park.mjs',
      'pr:merge': 'node scripts/pr-merge.mjs',
      'branch-protection:apply': 'node scripts/apply-branch-protection.mjs',
      'repo-merge-settings:apply': 'node scripts/apply-repo-merge-settings.mjs',
    },
  };
  writeFileSync(join(target, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  run('npm', ['install', '--package-lock-only', '--ignore-scripts'], { cwd: target });

  run('git', ['init', '-b', 'main'], { cwd: target });
  run('git', ['add', '-A'], { cwd: target });
  run('git', ['commit', '-m', 'chore: initialise protected repository'], { cwd: target });
  const createArgs = ['repo', 'create', repo, `--${args.visibility}`, '--source', target, '--remote', 'origin', '--push'];
  if (args.description) createArgs.push('--description', args.description);
  run('gh', createArgs, { cwd: target });

  run('gh', ['variable', 'set', 'BOT_WAIT_REQUIRED', '--body', 'off', '--repo', repo]);
  run('gh', ['variable', 'set', 'QWEN_ENABLED', '--body', 'false', '--repo', repo]);
  const actionsPayload = JSON.stringify({
    default_workflow_permissions: 'read',
    can_approve_pull_request_reviews: true,
  });
  run(
    'gh',
    ['api', '--method', 'PUT', `repos/${repo}/actions/permissions/workflow`, '--input', '-'],
    { input: actionsPayload },
  );
  run('node', [join(root, 'scripts', 'apply-repo-merge-settings.mjs')], { cwd: target });
  run('node', [join(root, 'scripts', 'apply-branch-protection.mjs')], {
    cwd: target,
    env: { ...process.env, PR_REQUIRED_CHECKS: 'repo-ci,bot-feedback-gate' },
  });

  console.log(JSON.stringify({ ...plan, created: true }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`repo:create:standard: ${error.message}`);
  process.exit(1);
}
