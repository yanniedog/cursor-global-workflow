#!/usr/bin/env node
/**
 * Call a self-hosted OpenAI-compatible Qwen endpoint to review a PR diff.
 * Exit non-zero on any missing config, API failure, empty response, or git error.
 *
 * Env:
 *   QWEN_API_BASE_URL  (required) e.g. https://host/v1
 *   QWEN_API_KEY       (optional) Bearer token when set
 *   QWEN_MODEL         (optional) default qwen3-coder:30b
 *   PR_NUMBER          (optional) for prompt context
 *   BASE_REF           (required) base branch name
 *   GITHUB_REPOSITORY  (optional) owner/name
 *   PROMPT_PATH        (optional) default .cursor/PR_REVIEW_PROMPT.md
 *   OUT_FILE           (optional) write review markdown here; also stdout
 *   DIFF_MAX_CHARS     (optional) truncate diff; default 350000
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_MODEL = 'qwen3-coder:30b';
const DEFAULT_DIFF_MAX = 350_000;

function log(msg) {
  console.error(`[qwen-pr-review] ${msg}`);
}

function fail(msg, code = 1) {
  log(`ERROR: ${msg}`);
  process.exit(code);
}

function requireEnv(name) {
  const v = (process.env[name] || '').trim();
  if (!v) fail(`${name} is required`);
  return v;
}

function runGit(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.error) fail(`git ${args.join(' ')}: ${r.error.message}`);
  if (r.status !== 0) {
    fail(`git ${args.join(' ')} failed (exit ${r.status}): ${(r.stderr || r.stdout || '').trim()}`);
  }
  return r.stdout || '';
}

function normalizeBaseUrl(raw) {
  let base = raw.replace(/\/+$/, '');
  if (!/\/v1$/i.test(base)) {
    base = `${base}/v1`;
    log(`QWEN_API_BASE_URL had no /v1 suffix; using ${base}`);
  }
  return base;
}

function buildUserPrompt({ rubric, repo, prNumber, baseRef, headSha, diff }) {
  const parts = [
    rubric.trim(),
    '',
    `Repository: ${repo || '(unknown)'}`,
    `Pull request: #${prNumber || '(unknown)'}`,
    `Base branch: ${baseRef}`,
    `Head commit: ${headSha}`,
    '',
    'Review only the pull request diff below. Do not edit files, commit, push, or post comments yourself.',
    '',
    '```diff',
    diff,
    '```',
  ];
  return parts.join('\n');
}

async function main() {
  const baseUrl = normalizeBaseUrl(requireEnv('QWEN_API_BASE_URL'));
  const apiKey = (process.env.QWEN_API_KEY || '').trim();
  const model = (process.env.QWEN_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const baseRef = requireEnv('BASE_REF');
  const prNumber = (process.env.PR_NUMBER || '').trim();
  const repo = (process.env.GITHUB_REPOSITORY || '').trim();
  const promptPath = resolve(process.env.PROMPT_PATH || '.cursor/PR_REVIEW_PROMPT.md');
  const outFile = (process.env.OUT_FILE || '').trim();
  const diffMax = Number(process.env.DIFF_MAX_CHARS || DEFAULT_DIFF_MAX) || DEFAULT_DIFF_MAX;

  if (!existsSync(promptPath)) {
    fail(`Prompt file not found: ${promptPath}`);
  }

  log(`model=${model}`);
  log(`base_url=${baseUrl}`);
  log(`base_ref=${baseRef}`);
  log(`prompt=${promptPath}`);
  log(`api_key=${apiKey ? 'set' : 'unset'}`);

  const headSha = runGit(['rev-parse', 'HEAD']).trim();
  if (!headSha) fail('Could not resolve HEAD sha');

  log(`Fetching origin/${baseRef}...`);
  runGit(['fetch', 'origin', baseRef, '--depth=1']);

  let diff = runGit(['diff', `origin/${baseRef}...HEAD`]);
  if (!diff.trim()) {
    log('WARNING: empty diff; continuing with empty-diff review request');
    diff = '(no file changes in this pull request range)';
  } else if (diff.length > diffMax) {
    log(`WARNING: diff truncated from ${diff.length} to ${diffMax} chars`);
    diff = `${diff.slice(0, diffMax)}\n\n... [diff truncated at ${diffMax} chars] ...`;
  }

  const rubric = readFileSync(promptPath, 'utf8');
  if (!rubric.trim()) fail(`Prompt file is empty: ${promptPath}`);

  const userContent = buildUserPrompt({
    rubric,
    repo,
    prNumber,
    baseRef,
    headSha,
    diff,
  });

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          'You are a careful senior code reviewer. Return markdown only in the required output format. Do not refuse to review.',
      },
      { role: 'user', content: userContent },
    ],
  };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  log(`POST ${url}`);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    fail(`Request failed: ${err?.message || err}`);
  }

  const rawText = await res.text();
  if (!res.ok) {
    fail(`API HTTP ${res.status}: ${rawText.slice(0, 2000)}`);
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    fail(`API returned non-JSON: ${rawText.slice(0, 500)}`);
  }

  if (json?.error) {
    fail(`API error: ${typeof json.error === 'string' ? json.error : JSON.stringify(json.error)}`);
  }

  const choice = json?.choices?.[0];
  const content =
    choice?.message?.content ||
    choice?.text ||
    (typeof json?.content === 'string' ? json.content : '');

  const review = String(content || '').trim();
  if (!review) {
    fail(`Empty review content. Raw response (truncated): ${rawText.slice(0, 1000)}`);
  }

  if (outFile) {
    writeFileSync(outFile, `${review}\n`, 'utf8');
    log(`Wrote review to ${outFile} (${review.length} chars)`);
  }

  process.stdout.write(`${review}\n`);
  log('Review completed successfully');
}

main().catch((err) => {
  fail(err?.stack || err?.message || String(err));
});
