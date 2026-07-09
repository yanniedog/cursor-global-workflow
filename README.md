# cursor-global-workflow

Reusable Cursor agents, rules, and scripts for **all** projects — chief coordination, ship bar, bot wait, PR thread closure, and browser QA.

Install once per machine. After install, **every git repo** under your code folder is bootstrapped automatically when you open it in **Cursor** (zero manual steps per repo).

---

## Zero-touch automation (Cursor only)

Hooks are **Cursor-specific** — they do not run in VS Code.

| Trigger | Hook event | Script |
|---------|------------|--------|
| Open any workspace in Cursor | `sessionStart` (user-global `~/.cursor/hooks.json`) | `repo-auto-bootstrap.mjs` |

On each session start, if `.cursor/workflow-bootstrapped` is missing or older than the global `bootstrap-version.txt`, the hook creates:

- `.cursor/rules/00-use-global-workflow.mdc` (from installed template)
- `.cursor/workflow-bootstrapped` (version marker)
- `WORKFLOW.md` at repo root **only if missing** (never overwrites)
- npm script stubs in `package.json` **only for missing keys** (never overwrites existing scripts)

Idempotent and fast; no secrets.

**New repos:** create or `git init` a folder under your code directory, open it in Cursor once — bootstrap runs via `sessionStart`.

**Existing repos (one-time batch):**

```powershell
cd $env:USERPROFILE\code\cursor-global-workflow
.\install.ps1
.\scripts\bootstrap-all-repos.ps1 -CodeRoot $env:USERPROFILE\code -Commit
```

Use `-Push` only when you want every bootstrapped repo pushed (optional).

Bump `bootstrap-version.txt` and re-run `install.ps1` to refresh all repos on next Cursor open.

---

## VS Code opening instead of Cursor (Windows)

If double-clicking a folder or a shortcut opens **VS Code** instead of **Cursor**:

1. **Right-click the folder** → **Open with** → choose **Cursor** → check **Always use this app**.
2. **Settings → Apps → Default apps** → set `.code-workspace` / folder handler if needed.
3. Install the **`cursor` CLI**: Cursor → Command Palette → **Shell Command: Install 'cursor' command in PATH**. Then: `cursor .` from the repo root.
4. Avoid **VS Code-only** shortcuts (pinned VS Code taskbar icon, `code .` in terminal, VS Code "Open Recent").
5. For Git: set `core.editor` to Cursor if you use `git commit` without `-m`.

---

## Global sync contract

**Canonical source:** [github.com/yanniedog/cursor-global-workflow](https://github.com/yanniedog/cursor-global-workflow)

When you change shared agent plumbing in **any** project, mirror it here **in the same work** (or immediately after) so installs under `~/.cursor/skills/` and `~/.cursor/workflow-scripts/` do not drift.

| Must mirror | Examples |
|-------------|----------|
| Skills | `chief-agent`, `workflow-orchestrator`, `deep-browser-explore`, `agent-auditor` |
| Scripts | `wait_for_bots.mjs`, `chief-scan.mjs`, `pr-bot-feedback-check*`, `ship-closeout*`, `agent-auditor-scan*`, `orchestrator-remind`, `repo-auto-bootstrap.mjs` |
| Hooks | `auditor-watch.mjs`, `orchestrator-remind.mjs` |
| Rules | `chief-agent-always`, `workflow-orchestrator-always`, `agent-auditor-always`, ship-bar rules in `rules/` |

**Chief** assigns sync when a worker edits listed paths. **Orchestrator** runs a **global mirror check** before merge when the project PR touches them. Scrub private paths and secrets before pushing.

Rule: `rules/global-feature-sync.mdc` (`alwaysApply: true`). Invoke: **"sync global workflow"**.

---

## Placeholders (per project)

Configure in the repo's `WORKFLOW.md`, `AGENTS.md`, and `.cursor/project.json`:

| Placeholder | Meaning | Example |
|-------------|---------|---------|
| `{PROJECT_NAME}` | Display name | `my-api`, `my-app` |
| `{VERIFY_COMMAND}` | Post-merge smoke test | `npm test` or `npm run smoke -- --base-url=http://127.0.0.1:3000/` |
| `{DEPLOY_COMMAND}` | Restart dev server or deploy | `npm run dev` or your deploy script |
| `{DEPLOY_URL}` | Acceptance URL (optional) | `https://staging.example.com/` |

---

## Install tiers

### 1. User-global (recommended)

One install serves every existing and future repo.

**Windows (PowerShell):**

```powershell
git clone https://github.com/yanniedog/cursor-global-workflow.git $env:USERPROFILE\code\cursor-global-workflow
cd $env:USERPROFILE\code\cursor-global-workflow
.\install.ps1
```

**macOS / Linux:**

```sh
git clone https://github.com/yanniedog/cursor-global-workflow.git ~/code/cursor-global-workflow
cd ~/code/cursor-global-workflow
./install.sh
```

Install copies:

- `skills/*` → `~/.cursor/skills/` (never `skills-cursor/` — reserved by Cursor)
- `rules/*` → `~/.cursor/rules/`
- `scripts/*` → `~/.cursor/workflow-scripts/`
- Sets user env `CURSOR_WORKFLOW_SCRIPTS` to the scripts path

**One-liner (after clone):**

```powershell
cd $env:USERPROFILE\code\cursor-global-workflow; .\install.ps1
```

### 2. Per-repo opt-in

Add npm scripts (merge into existing `package.json`):

```json
{
  "scripts": {
    "wait-for-bots": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\wait_for_bots.mjs\"",
    "chief:scan": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\chief-scan.mjs\"",
    "pr:bot-feedback-check": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\pr-bot-feedback-check.mjs\"",
    "pr:bot-feedback-audit": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\pr-bot-feedback-check.mjs\" --audit-merged --limit 20",
    "pr:gates:check": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\pr-gates-check.mjs\"",
    "pr:watch-once": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\pr-watch-once.mjs\"",
    "pr:queue:drive": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\pr-queue-drive.mjs\"",
    "pr:update-branch": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\pr-update-branch.mjs\"",
    "pr:merge": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\pr-merge.mjs\"",
    "ship:closeout:strict": "node \"%CURSOR_WORKFLOW_SCRIPTS%\\ship-closeout-strict.mjs\"",
    "git:graph-hygiene": "git fetch origin --prune"
  }
}
```

On Unix, use `$CURSOR_WORKFLOW_SCRIPTS` instead of `%CURSOR_WORKFLOW_SCRIPTS%`.

Copy CI workflow:

```sh
cp workflows/pr-bot-feedback-check.yml YOUR_REPO/.github/workflows/
cp workflows/pr-request-bot-reviews.yml YOUR_REPO/.github/workflows/
cp workflows/pr-bot-presence-gate.yml YOUR_REPO/.github/workflows/  # if using presence gate
```

Copy hook stub:

```sh
cp hooks.json.example YOUR_REPO/.cursor/hooks.json
# Edit paths to point at CURSOR_WORKFLOW_SCRIPTS or copy orchestrator-remind.mjs locally
```

Or use submodule:

```sh
git submodule add https://github.com/yanniedog/cursor-global-workflow.git .cursor/global-workflow
```

### 3. Existing repos

Preferred: run **tier 1** install, then either open each repo in Cursor (auto) or `scripts/bootstrap-all-repos.ps1 -Commit`.

Manual fallback (only if hooks disabled):

1. Run **tier 1** install once on the machine.
2. Copy `templates/00-use-global-workflow.mdc` → `YOUR_REPO/.cursor/rules/00-use-global-workflow.mdc`
3. Copy `templates/WORKFLOW.md` → `YOUR_REPO/WORKFLOW.md` and fill placeholders.
4. Add npm scripts from tier 2 (or keep local script copies that delegate to global path).

---

## What's included

| Piece | Purpose |
|-------|---------|
| **chief-agent** skill | Session coordination, path/branch locks, solution-first delegation |
| **workflow-orchestrator** skill | Ship bar loop, one PR per task, bot wait |
| **deep-browser-explore** skill | Browser MCP QA with configurable base URL |
| **agent-auditor** skill | Meta-monitor above chief; transcript/git/scan audit |
| **babysit** | Use Cursor built-in [`babysit` skill](https://cursor.com) — orchestrator delegates open PR babysitting there |
| **wait_for_bots.mjs** | Dynamic bot wait gate (step 5) |
| **chief-scan.mjs** | Pre-delegate repo health scan |
| **pr-bot-feedback-check.mjs** | Thread closure gate before merge |
| **ship-closeout-strict.mjs** | Exit 2 while open PR exists |
| **Rules** | git-pr-workflow, no-early-stop, bot replies, multiagent-modularity |
| **WORKFLOW.md** | Generic 9-step ship bar template |

---

## Requirements

- **Node.js** 18+
- **gh** CLI authenticated (`gh auth login`)
- **Cursor** (not VS Code) for skills/hooks

---

## Updating

```sh
cd ~/code/cursor-global-workflow   # or your clone path
git pull
.\install.ps1   # or ./install.sh
```

Re-run install after pull to refresh `~/.cursor/skills`, rules, and scripts.
