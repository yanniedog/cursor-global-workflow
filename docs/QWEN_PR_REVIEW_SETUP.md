# Qwen Code PR Review (self-hosted Ollama)

Uses a **self-hosted Windows runner** on the machine that runs Ollama, calling the local OpenAI-compatible API (`http://127.0.0.1:11434/v1`) with **`qwen3-coder:30b`**.

This matches the simjury `pr-local-llm-review` pattern (`runs-on: [self-hosted, Windows, X64, …]`).

## Prerequisites

1. Ollama installed with model `qwen3-coder:30b` (`ollama list`).
2. Self-hosted runner registered to the repo with label **`qwen-local-llm`** (example: `C:\actions-runner-cgw`, agent `surface-laptop-5-qwen-cgw`).
3. Runner process online (`gh api repos/<owner>/<repo>/actions/runners`).

## Secrets (optional on self-hosted)

Defaults are applied in the workflow when secrets are empty:

| Secret | Default |
|--------|---------|
| `QWEN_API_BASE_URL` | `http://127.0.0.1:11434/v1` |
| `QWEN_MODEL` | `qwen3-coder:30b` |
| `QWEN_API_KEY` | unset (Ollama does not require one) |

```powershell
gh secret set QWEN_API_BASE_URL --repo OWNER/REPO --body 'http://127.0.0.1:11434/v1'
gh secret set QWEN_MODEL --repo OWNER/REPO --body 'qwen3-coder:30b'
# Or batch:
.\scripts\setup-qwen-pr-review.ps1
```

## Workflow behavior

- Triggers on PR `opened`, `synchronize`, `reopened`, `ready_for_review`.
- Triggers on PR comments containing `@qwen-review` (force re-review).
- Rejects fork PRs (private laptop reviewer).
- Posts/updates comment with `<!-- qwen-code-review -->`.
- Check run: `qwen-code-review`.

## Bot wait / tagging

```sh
# After fix pushes — mention bots and wake Qwen:
# @qwen-review
npm run wait-for-bots -- --bot-tag
```

Required bots default: `gemini,codex,sourcery,qwen`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Job queued forever | Start runner: `C:\actions-runner-cgw\run.cmd`; confirm label `qwen-local-llm` |
| Connection refused | Ensure Ollama is running (`ollama list`, port 11434) |
| Slow / timeout | First load of 30B is slow; keep Ollama warm; workflow timeout is 45m |
| Fork PR failed | Same-repo PRs only on the laptop runner |
