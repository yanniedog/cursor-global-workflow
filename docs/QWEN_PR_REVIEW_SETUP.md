# Qwen Code PR Review (self-hosted)

Uses GitHub Actions to call your **OpenAI-compatible** Qwen 3 Coder endpoint (`chat/completions`) and post a PR review comment. No Cursor CLI / Auto quota.

## One-time setup

1. Run a reachable Qwen 3 Coder 30B OpenAI-compatible server (public URL, tunnel, or self-hosted GitHub runner on the same network). Localhost-only endpoints are **not** reachable from `ubuntu-latest`.
2. Set GitHub secrets per repo (or batch):

```powershell
# From cursor-global-workflow/scripts after install
$env:QWEN_API_BASE_URL = 'https://your-host/v1'
$env:QWEN_API_KEY = '...'           # optional
$env:QWEN_MODEL = 'qwen3-coder:30b' # optional default
.\setup-qwen-pr-review.ps1
```

Secrets:

| Secret | Required | Notes |
|--------|----------|--------|
| `QWEN_API_BASE_URL` | yes | Base URL; `/v1` is appended if missing |
| `QWEN_API_KEY` | no | Sent as `Authorization: Bearer` when set |
| `QWEN_MODEL` | no | Default `qwen3-coder:30b` |

## Install / bootstrap repos

```powershell
cd cursor-global-workflow
.\install.ps1

node $env:CURSOR_WORKFLOW_SCRIPTS\repo-auto-bootstrap.mjs --batch-root $env:USERPROFILE\code

.\scripts\commit-cursor-pr-review.ps1
# Or with push:
.\scripts\bootstrap-all-repos.ps1 -Commit -Push
```

## What gets added to each repo

| Path | Purpose |
|------|---------|
| `.github/workflows/cursor-auto-pr-review.yml` | Runs Qwen review on PRs and `@qwen-review` tags |
| `scripts/qwen-pr-review.mjs` | OpenAI-compatible caller |
| `.cursor/PR_REVIEW_PROMPT.md` | Review rubric |

## Workflow behavior

- Triggers on PR `opened`, `synchronize`, `reopened`, `ready_for_review` (all paths).
- Triggers on PR issue comments containing `@qwen-review` (force re-review for the same SHA).
- Skips bot-authored and `chore(...)` PRs on automatic `pull_request` events only.
- Skips if `qwen-code-review` check already passed for the same commit (unless tagged / `workflow_dispatch`).
- Posts/updates a PR comment with `<!-- qwen-code-review -->`.
- Publishes check run `qwen-code-review`.

## Bot wait / tagging

After fix pushes, mention other bots **and** include `@qwen-review`, then:

```sh
npm run wait-for-bots -- --bot-tag
```

Required bots default: `gemini,codex,sourcery,qwen`. Qwen presence counts only for `github-actions[bot]` comments that contain `<!-- qwen-code-review -->` (legacy `<!-- cursor-auto-review -->` still accepted).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Check fails: missing base URL | Set `QWEN_API_BASE_URL` repo secret |
| Connection refused / timeout | Endpoint must be reachable from the Actions runner |
| Wrong model | Set `QWEN_MODEL` secret |
| Tag did not re-review | Comment must contain exact `@qwen-review` on a PR (not a plain issue) |
| Bot gate missing qwen | Ensure comment marker `<!-- qwen-code-review -->` and `AR_BOT_WAIT_REQUIRED` includes `qwen` |
