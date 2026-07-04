# Cursor Auto PR Review (Pro+ / Auto quota)

Uses the Cursor CLI in GitHub Actions with `--model auto` so reviews draw from your **Auto + Composer** subscription quota — not Bugbot or Automations billing.

## One-time setup

1. **Cursor dashboard** — [cursor.com/dashboard](https://cursor.com/dashboard) → **API Keys** → create `CURSOR_API_KEY`.
2. **Disable on-demand overage** — Settings → Usage (avoid surprise charges).
3. **GitHub secrets** — per repo (personal account) or run the batch script:

```powershell
# From cursor-global-workflow/scripts after install
.\setup-cursor-pr-review.ps1
# Or: $env:CURSOR_API_KEY = '...'; .\setup-cursor-pr-review.ps1
```

## Install / bootstrap repos

```powershell
# Install global scripts + templates (Windows)
cd cursor-global-workflow
.\install.ps1

# Bootstrap all repos under ~/code (copies workflow if missing; v4+ refreshes workflow on upgrade)
node $env:CURSOR_WORKFLOW_SCRIPTS\repo-auto-bootstrap.mjs --batch-root $env:USERPROFILE\code

# Commit cursor review files across repos
.\scripts\commit-cursor-pr-review.ps1
# Or with push:
.\scripts\bootstrap-all-repos.ps1 -Commit -Push
```

## What gets added to each repo

| Path | Purpose |
|------|---------|
| `.github/workflows/cursor-auto-pr-review.yml` | Runs `agent -p ... --model auto` on PRs |
| `.cursor/PR_REVIEW_PROMPT.md` | Review rubric passed to the agent |
| `.cursor/cli.json` | Read-only CLI permissions in CI |

## Workflow behavior

- Triggers on PR `opened`, `synchronize`, `reopened`, `ready_for_review` (ignores markdown-only / `.github/**` path changes).
- Skips bot-authored and `chore(...)` PRs.
- Skips if `cursor-auto-review` check already passed for the same commit.
- Posts/updates a PR comment with `<!-- cursor-auto-review -->`.
- Publishes advisory `cursor-auto-review` check run.

## Verify billing

Open a PR with a non-markdown code change. After the workflow runs, confirm usage in Cursor dashboard → Usage (Auto/Composer pool, not Bugbot).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Check fails: missing API key | Set `CURSOR_API_KEY` repo secret |
| No workflow run | PR must touch paths outside `**/*.md` and `.github/**` |
| `agent` not found locally | CLI is installed only on the Actions runner |
| Bot gate ignores cursor | Ensure comment contains `<!-- cursor-auto-review -->` |
