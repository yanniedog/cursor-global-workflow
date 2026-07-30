# Qwen Code PR Review (self-hosted Ollama)

Uses a **self-hosted Windows runner** on the machine that runs Ollama, calling the local OpenAI-compatible API (`http://127.0.0.1:11434/v1`) with **`qwen3-coder-review:30b`**.

This matches the simjury `pr-local-llm-review` pattern (`runs-on: [self-hosted, Windows, X64, …]`).

## Prerequisites

1. Ollama installed with the review model:
   `ollama create qwen3-coder-review:30b -f scripts/qwen-review.Modelfile`.
   This pins a 16,384-token context instead of relying on Ollama's
   hardware-derived default.
2. Self-hosted runner registered to the repo with label **`qwen-local-llm`** (example: `C:\actions-runner-cgw`, agent `surface-laptop-5-qwen-cgw`).
3. Runner process online (`gh api repos/<owner>/<repo>/actions/runners`).

## Secrets (optional on self-hosted)

Defaults are applied in the workflow when secrets are empty:

| Secret | Default |
|--------|---------|
| `QWEN_API_BASE_URL` | `http://127.0.0.1:11434/v1` |
| `QWEN_MODEL` | `qwen3-coder-review:30b` |
| `QWEN_API_KEY` | unset (Ollama does not require one) |

```powershell
gh secret set QWEN_API_BASE_URL --repo OWNER/REPO --body 'http://127.0.0.1:11434/v1'
gh secret set QWEN_MODEL --repo OWNER/REPO --body 'qwen3-coder-review:30b'
# Or batch:
.\scripts\setup-qwen-pr-review.ps1
```

## Workflow behavior

- Uses `pull_request_target` so the workflow definition, reviewer script, prompt,
  and repository policy are loaded from protected `main`.
- Checks out the PR head separately with no persisted credentials and treats it
  only as diff data; PR-controlled code is never executed on the private runner.
- Triggers on PR `opened`, `synchronize`, `reopened`, `ready_for_review`.
- Triggers on PR comments containing `@qwen-review` (force re-review).
- Reads fork heads through the base repository's pull ref without granting the
  fork a token or executing any PR-controlled code.
- Posts a new formal review for each head with `<!-- qwen-code-review -->`, the
  exact reviewed commit, outcome, model, file coverage, and workflow URL.
- Reviews every reviewable file in bounded 24,000-character chunks. If the
  160,000-character whole-PR budget would omit a reviewable file, the run fails
  instead of publishing a partial success. Generated, lock, documentation, and
  asset files are reported separately as intentional low-signal exclusions.
- Publishes the current-head check run `qwen-code-review`; failed reviews remain
  failed and do not satisfy reviewer presence.

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
| Review reports `Operation not allowed` | Recreate `qwen3-coder-review:30b` from the checked-in Modelfile and confirm `ollama ps` shows context `16384` |
