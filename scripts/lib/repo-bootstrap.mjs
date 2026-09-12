#!/usr/bin/env node
/**
 * Idempotent per-repo bootstrap for cursor-global-workflow.
 * Used by sessionStart hook and batch bootstrap CLI.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { platform } from 'node:os';

const NPM_STUBS = {
  'wait-for-bots': 'wait_for_bots.mjs',
  'chief:scan': 'chief-scan.mjs',
  'pr:bot-feedback-check': 'pr-bot-feedback-check.mjs',
  'pr:bot-feedback-audit': 'pr-bot-feedback-check.mjs --audit-merged --limit 20',
  'pr:gates:check': 'pr-gates-check.mjs',
  'pr:arm-and-park': 'pr-arm-and-park.mjs',
  'pr:watch-once': 'pr-watch-once.mjs',
  'pr:queue:drive': 'pr-queue-drive.mjs',
  'pr:update-branch': 'pr-update-branch.mjs',
  'pr:merge': 'pr-merge.mjs',
  'ship:closeout:strict': 'ship-closeout-strict.mjs',
  'git:graph-hygiene': null,
};

function scriptsHome() {
  const fromEnv = process.env.CURSOR_WORKFLOW_SCRIPTS;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const fallback = join(home, '.cursor', 'workflow-scripts');
  if (existsSync(fallback)) return fallback;
  throw new Error(
    'CURSOR_WORKFLOW_SCRIPTS not set and ~/.cursor/workflow-scripts missing. Run install.ps1 or install.sh.',
  );
}

function readGlobalVersion(scriptsRoot) {
  const p = join(scriptsRoot, 'bootstrap-version.txt');
  if (!existsSync(p)) return '0';
  return readFileSync(p, 'utf8').trim() || '0';
}

function readMarkerVersion(markerPath) {
  if (!existsSync(markerPath)) return null;
  const raw = readFileSync(markerPath, 'utf8').trim();
  const first = raw.split(/\r?\n/)[0].trim();
  return first || null;
}

function compareVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

function nodeScriptCmd(scriptRoot, relScript) {
  const isWin = platform() === 'win32';
  const base = isWin
    ? join('%CURSOR_WORKFLOW_SCRIPTS%', relScript.replace(/\//g, '\\'))
    : join('$CURSOR_WORKFLOW_SCRIPTS', relScript);
  return `node "${base}"`;
}

function readPackageJson(pkgPath) {
  const buf = readFileSync(pkgPath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return JSON.parse(buf.toString('utf16le'));
  }
  if (buf.length >= 2 && buf[0] === 0x7b && buf[1] === 0x00) {
    return JSON.parse(buf.toString('utf16le'));
  }
  return JSON.parse(buf.toString('utf8'));
}

function patchPackageJson(pkgPath, scriptsRoot) {
  if (!existsSync(pkgPath)) return { patched: false, reason: 'no package.json' };
  let pkg;
  try {
    pkg = readPackageJson(pkgPath);
  } catch {
    return { patched: false, reason: 'invalid package.json' };
  }
  if (!pkg.scripts || typeof pkg.scripts !== 'object') pkg.scripts = {};
  let added = 0;
  for (const [name, rel] of Object.entries(NPM_STUBS)) {
    if (pkg.scripts[name]) continue;
    if (name === 'git:graph-hygiene') {
      pkg.scripts[name] = 'git fetch origin --prune';
    } else if (rel.includes(' ')) {
      const [file, ...args] = rel.split(' ');
      pkg.scripts[name] = `${nodeScriptCmd(scriptsRoot, file)} ${args.join(' ')}`;
    } else {
      pkg.scripts[name] = nodeScriptCmd(scriptsRoot, rel);
    }
    added += 1;
  }
  if (added === 0) return { patched: false, reason: 'scripts complete' };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return { patched: true, added };
}

function copyTemplateIfMissing(src, dest, relDest, result) {
  if (!existsSync(src) || existsSync(dest)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  result.files.push(relDest);
  return true;
}

/**
 * @param {string} workspaceRoot
 * @param {{ dryRun?: boolean }} [opts]
 */
export function bootstrapRepo(workspaceRoot, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const result = {
    workspace: workspaceRoot,
    bootstrapped: false,
    skipped: false,
    reason: '',
    files: [],
    packageJson: null,
  };

  if (!workspaceRoot || !existsSync(workspaceRoot)) {
    result.skipped = true;
    result.reason = 'workspace missing';
    return result;
  }

  const gitDir = join(workspaceRoot, '.git');
  if (!existsSync(gitDir)) {
    result.skipped = true;
    result.reason = 'not a git repo';
    return result;
  }

  let scriptsRoot;
  try {
    scriptsRoot = scriptsHome();
  } catch (err) {
    result.skipped = true;
    result.reason = err.message;
    return result;
  }

  const globalVersion = readGlobalVersion(scriptsRoot);
  const cursorDir = join(workspaceRoot, '.cursor');
  const rulesDir = join(cursorDir, 'rules');
  const markerPath = join(cursorDir, 'workflow-bootstrapped');
  const markerVersion = readMarkerVersion(markerPath);

  if (markerVersion !== null && compareVersion(markerVersion, globalVersion) >= 0) {
    result.skipped = true;
    result.reason = `already at v${markerVersion}`;
    return result;
  }

  const templatesDir = join(scriptsRoot, 'templates');
  const ruleTemplate = join(templatesDir, '00-use-global-workflow.mdc');
  const workflowTemplate = join(templatesDir, 'WORKFLOW.md');
  const feedbackWorkflowTemplate = join(
    templatesDir,
    '.github',
    'workflows',
    'pr-bot-feedback-check.yml',
  );
  const cursorCliConfigTemplate = join(templatesDir, '.cursor', 'cli.json');
  const ruleDest = join(rulesDir, '00-use-global-workflow.mdc');
  const workflowDest = join(workspaceRoot, 'WORKFLOW.md');
  const feedbackWorkflowDest = join(
    workspaceRoot,
    '.github',
    'workflows',
    'pr-bot-feedback-check.yml',
  );
  const cursorCliConfigDest = join(cursorDir, 'cli.json');

  if (dryRun) {
    result.bootstrapped = true;
    result.reason = 'dry-run';
    return result;
  }

  mkdirSync(rulesDir, { recursive: true });

  if (existsSync(ruleTemplate)) {
    copyFileSync(ruleTemplate, ruleDest);
    result.files.push('.cursor/rules/00-use-global-workflow.mdc');
  }

  const markerBody = `${globalVersion}\nbootstrapped-at=${new Date().toISOString()}\n`;
  writeFileSync(markerPath, markerBody, 'utf8');
  result.files.push('.cursor/workflow-bootstrapped');

  if (!existsSync(workflowDest) && existsSync(workflowTemplate)) {
    copyFileSync(workflowTemplate, workflowDest);
    result.files.push('WORKFLOW.md');
  }

  copyTemplateIfMissing(
    feedbackWorkflowTemplate,
    feedbackWorkflowDest,
    '.github/workflows/pr-bot-feedback-check.yml',
    result,
  );
  copyTemplateIfMissing(cursorCliConfigTemplate, cursorCliConfigDest, '.cursor/cli.json', result);

  const gateScripts = [
    'pr-bot-feedback-check.mjs',
    'lib/bot-wait-config.mjs',
    'lib/bot-wait-presence.mjs',
    'lib/gh-pr-review-threads.mjs',
  ];
  for (const rel of gateScripts) {
    copyTemplateIfMissing(
      join(scriptsRoot, rel),
      join(workspaceRoot, 'scripts', rel),
      `scripts/${rel}`,
      result,
    );
  }

  const pkgPath = join(workspaceRoot, 'package.json');
  result.packageJson = patchPackageJson(pkgPath, scriptsRoot);

  result.bootstrapped = true;
  result.reason =
    markerVersion === null ? 'fresh bootstrap' : `upgraded v${markerVersion} -> v${globalVersion}`;
  return result;
}
