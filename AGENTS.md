# Global Cursor agents — index

Installed to `~/.cursor/skills/` by `install.ps1` / `install.sh`. Per-repo copies are optional.

The global sync contract also applies to `codex-cloud/` and `scripts/bootstrap-codex-cloud.ps1`. Keep these files portable, secret-free, and usable from Linux Cloud containers.

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
| **Chief agent** | `skills/chief-agent/SKILL.md` | "run chief agent" — coordination, locks; spawns **one pr-fix/babysit per open PR** |
| **Workflow orchestrator** | `skills/workflow-orchestrator/SKILL.md` | "run workflow orchestrator" — queue coordination, splits, routing; spawns pr-fix per PR |
| **PR fix** | `skills/pr-fix-agent/SKILL.md` | "run pr fix" — **one dedicated worker per open PR:** threads, CI, synthesis, gates, squash merge |
| **Deep browser explore** | `skills/deep-browser-explore/SKILL.md` | Browser MCP QA; base URL from `.cursor/project.json` or env |
| **Agent auditor** | `skills/agent-auditor/SKILL.md` | Meta-monitor above chief; `npm run agent:auditor` |
| **Babysit (PR)** | Cursor built-in | pr-fix workers use **babysit** skill (`~/.cursor/skills-cursor/babysit/SKILL.md`) for triage patterns |

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
| `pr:gates:check` | `pr-gates-check.mjs` |
| `pr:arm-and-park` | `pr-arm-and-park.mjs` |
| `pr:watch-once` | `pr-watch-once.mjs` |
| `pr:queue:drive` | `pr-queue-drive.mjs` |
| `pr:update-branch` | `pr-update-branch.mjs` |
| `pr:merge` | `pr-merge.mjs` |
| `ship:closeout:strict` | `ship-closeout-strict.mjs` |
| `agent:auditor` | `agent-auditor-scan.mjs` |

Review vendors and Qwen/local-LLM are advisory. New repositories are created
with `npm run repo:create:standard`; this installs deterministic CI plus the
required feedback gate and applies GitHub protection/merge settings. Do not
bootstrap Qwen or `bot-presence-gate` as required checks. The legacy Qwen setup
guide is retained only for an explicit owner opt-in.

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

## Cursor Cloud specific instructions

This repo is a dependency-free Node.js ESM CLI toolkit — there is no bundled app, build step, or test/lint framework. `package.json` declares **no dependencies**, so `npm install` is a no-op (prints "up to date", creates no `node_modules`). Requires Node 18+ and an authenticated `gh` CLI (both preinstalled in Cloud).

- **Run the tools** via the `npm run` scripts in `package.json` (`chief:scan`, `agent:auditor`, `pr:gates:check`, `pr:bot-feedback-check`, `ship:closeout:strict`, etc.). Each script targets the current git repo (cwd = repo root) and shells out to `git` + `gh`.
- **Lint substitute** (no linter configured): `for f in scripts/*.mjs scripts/lib/*.mjs; do node --check "$f"; done` to syntax-check every script.
- **Quick smoke test:** `npm run chief:scan` (git+gh repo-health report) and `npm run agent:auditor` (audit report) should both exit 0 on a clean checkout.
- **Non-obvious gotchas:**
  - Several scripts poll or block by design: `wait-for-bots`, `pr:gates:check --watch`, `pr:queue:drive`, `ship:closeout:strict`. A **non-zero exit is often intentional** (a merge gate failing), not an environment error.
  - Most PR-oriented scripts only do meaningful work when there are open PRs / a real consumer-repo context; against a clean repo with no PRs they report "none" and exit 0.
  - Scripts write artifacts under the target repo's `.git/` (e.g. `.git/auditor/`, `.git/cursor-bot-wait/`), so they never dirty the tracked working tree.
  - `.ps1` scripts are Windows-only; use the `.mjs`/`.sh` equivalents on Linux.
