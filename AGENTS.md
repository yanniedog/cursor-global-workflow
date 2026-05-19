# Global Cursor agents — index

Installed to `~/.cursor/skills/` by `install.ps1` / `install.sh`. Per-repo copies are optional.

## Skills

| Skill | Path | Invoke |
|-------|------|--------|
| **Chief agent** | `skills/chief-agent/SKILL.md` | "run chief agent" — coordination, locks, solution-first delegation |
| **Workflow orchestrator** | `skills/workflow-orchestrator/SKILL.md` | "run workflow orchestrator" — ship bar, one PR per task |
| **Deep browser explore** | `skills/deep-browser-explore/SKILL.md` | Browser MCP QA; base URL from `.cursor/project.json` or env |
| **Babysit (PR)** | Cursor built-in | Orchestrator delegates open PR #N to **babysit** skill (`~/.cursor/skills-cursor/babysit/SKILL.md`) |

## Rules (user-global)

Copied to `~/.cursor/rules/` on install:

- `chief-agent-always.mdc`
- `workflow-orchestrator-always.mdc`
- `git-pr-workflow-default.mdc`
- `no-early-stop-after-pr.mdc`
- `pr-review-bot-replies.mdc`
- `respond-to-each-review-comment.mdc`
- `multiagent-modularity.mdc`
- `workflow-rules-never-overridden.mdc`

## Scripts

Installed to `~/.cursor/workflow-scripts/`; env `CURSOR_WORKFLOW_SCRIPTS` points there.

| npm script | Script |
|------------|--------|
| `wait-for-bots` | `wait_for_bots.mjs` |
| `chief:scan` | `chief-scan.mjs` |
| `pr:bot-feedback-check` | `pr-bot-feedback-check.mjs` |
| `ship:closeout:strict` | `ship-closeout-strict.mjs` |

Wire these in each repo's `package.json` (see README tier 2).

## Per-project config

Copy `templates/project.json.example` → `YOUR_REPO/.cursor/project.json`:

```json
{
  "workflow": {
    "projectName": "my-app",
    "verifyCommand": "npm test",
    "deployCommand": "npm run dev",
    "browserBaseUrl": "http://127.0.0.1:3000/"
  }
}
```

## Ship bar

Copy `WORKFLOW.md` template to repo root; fill `{PROJECT_NAME}`, `{VERIFY_COMMAND}`, `{DEPLOY_COMMAND}`, `{DEPLOY_URL}`.
