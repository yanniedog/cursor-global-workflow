# Global Cursor agents — index

Installed to `~/.cursor/skills/` by `install.ps1` / `install.sh`. Per-repo copies are optional.

## Global sync contract (no drift)

**Public repo:** [github.com/yanniedog/cursor-global-workflow](https://github.com/yanniedog/cursor-global-workflow)

Any edit to canonical skills, ship-bar scripts, hooks, or shared rules in this repo (or under `~/.cursor/skills/` / `~/.cursor/workflow-scripts/` after install) must be **committed and pushed here** before agents claim done on a project PR that touched the same files.

- **Chief** enforces: mirror in the same PR cycle or spawn a sync subagent.
- **Orchestrator** runs a **global mirror check** before merge when the project PR diff includes listed paths.
- **Rule:** `rules/global-feature-sync.mdc` — invoke with **"sync global workflow"**.

Scrub private hostnames, machine paths, and secrets from public commits.

## Skills

| Skill | Path | Invoke |
|-------|------|--------|
| **Chief agent** | `skills/chief-agent/SKILL.md` | "run chief agent" — coordination, locks, solution-first delegation |
| **Workflow orchestrator** | `skills/workflow-orchestrator/SKILL.md` | "run workflow orchestrator" — ship bar, one PR per task |
| **Deep browser explore** | `skills/deep-browser-explore/SKILL.md` | Browser MCP QA; base URL from `.cursor/project.json` or env |
| **Agent auditor** | `skills/agent-auditor/SKILL.md` | Meta-monitor above chief; `npm run agent:auditor` |
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
- `global-feature-sync.mdc`

## Scripts

Installed to `~/.cursor/workflow-scripts/`; env `CURSOR_WORKFLOW_SCRIPTS` points there.

| npm script | Script |
|------------|--------|
| `wait-for-bots` | `wait_for_bots.mjs` |
| `chief:scan` | `chief-scan.mjs` |
| `pr:bot-feedback-check` | `pr-bot-feedback-check.mjs` |
| `ship:closeout:strict` | `ship-closeout-strict.mjs` |
| `agent:auditor` | `agent-auditor-scan.mjs` |

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
