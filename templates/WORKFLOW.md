# Workflow — {PROJECT_NAME}

Generic ship bar for Cursor multi-agent projects. Copy to your repo root and replace placeholders (see global `README.md`).

Single authoritative source for agents. Self-contained — critical steps are listed here in full.

---

## Ship bar (9 steps + feedback synthesis)

All steps required unless the user **explicitly waives that step in writing for that PR**.

### 1. Branch from fresh main

```sh
git fetch origin && git checkout main && git pull origin main
git checkout -b agent/<slug>   # or feat/ or fix/
```

Distinctive slug (topic + short nonce like `-kj1`). Never reuse another agent's in-flight branch.

### 2. Commit and push

Commit only on the topic branch. `git push -u origin HEAD`.

### 3. PR to main

`gh pr create --base main`. One PR per deliverable. Fix-ups stay on the same branch — do NOT open a second PR.

### 4. CI green

`gh pr checks <n> --watch` until required checks pass. Fix forward on this PR. After fix pushes, `@mention` reviewers using handles from `gh pr view -c`, and include `@qwen-review` so Qwen Code re-reviews.

**Required GitHub status checks (when branch protection is enabled):** `bot-presence-gate`, `pr-bot-feedback-check`. Qwen Code Review appears as check `qwen-code-review`. Apply: `npm run branch-protection:apply`.

### 5. Bot wait trigger (dynamic)

```sh
npm run wait-for-bots
npm run wait-for-bots -- --watch
npm run wait-for-bots -- --bot-tag
```

Run after creating a new PR (or after tagging bots). Exit **2** = still waiting, **0** = ready, **1** = error/timeout.

**Ready when** (since wait anchor — PR creation or `--bot-tag`):

- Required CI checks are not pending, **and**
- **Every required bot** has posted since the anchor (default: **gemini**, **codex**, **sourcery**, **qwen**), **and**
- **90s** quiet window after last bot activity, **and**
- At least **60s** since anchor

Override: `AR_BOT_WAIT_REQUIRED=gemini,codex,sourcery,qwen` or `--require-bots`. Tag Qwen with `@qwen-review` before `--bot-tag`. If required bots never post before the safety cap, exit **1** — **DO NOT MERGE**.

### 5b. Feedback synthesis

Before thread replies: read all bot/human threads → post `## Feedback plan` on the PR → one implementation push → then in-thread replies.

### 6. Thread closure

Reply on every substantive thread: implemented (+ SHA) / deferred (reason) / declined (reason). Gate:

```sh
npm run pr:bot-feedback-check -- --pr <n>
```

### 7. Merge

`gh pr merge --squash` only after steps 5–6 **and** GitHub checks **`bot-presence-gate`** + **`pr-bot-feedback-check`** are green (when branch protection is enabled).

**Close without merge:** GitHub cannot block "Close pull request". Agents must not close without merge unless waived; `npm run agent:auditor` flags closed-unmerged PRs with open bot threads.

### 8. Deploy / restart

`{DEPLOY_COMMAND}` — restart local server, deploy, or refresh runtime so `main` is live.

### 9. Verify

`{VERIFY_COMMAND}` against `{DEPLOY_URL}` (if applicable). Exit **0** required.

---

## Closeout guard

```sh
npm run ship:closeout:strict && npm run wait-for-bots
```

- `ship:closeout:strict` exit **2** → open PR exists; continue steps 5–9.
- `wait-for-bots` exit **2** → bots not settled; re-run.

---

## Chief + orchestrator

- Parent agents spawn **chief** first (`~/.cursor/skills/chief-agent/SKILL.md`).
- Chief delegates ship bar to **workflow-orchestrator** (`~/.cursor/skills/workflow-orchestrator/SKILL.md`).
- One logical task → one branch → one PR.

---

## Branch protection

```sh
npm run branch-protection:apply
```

Requires **`bot-presence-gate`** and **`pr-bot-feedback-check`** on `main` plus **`required_conversation_resolution`**. See script output for manual UI steps if API fails (403). GitHub cannot block **Close pull request**.
