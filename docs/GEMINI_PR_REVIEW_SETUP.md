# Gemini PR Code Review Setup

Automated PR reviews via `sshnaidm/gemini-code-review-action@v2`.

## One-time: set the secret

1. Create a key at [Google AI Studio](https://aistudio.google.com/).
2. Store it as repository Actions secret `GEMINI_API_KEY`, or run:

```powershell
$env:GEMINI_API_KEY = 'YOUR_KEY'
.\scripts\setup-gemini-pr-review.ps1
```

## Workflow

Copy `templates/.github/workflows/gemini-review.yml` to `.github/workflows/gemini-review.yml` (bootstrap does this).

On `pull_request` opened/synchronize, Gemini posts a PR comment titled **Code Review by Gemini** (marker `<!-- gemini-code-review -->`). Ship-bar `wait-for-bots` treats that as the **gemini** required bot.
