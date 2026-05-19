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

`gh pr checks <n> --watch` until required checks pass. Fix forward on this PR. After fix pushes, `@mention` reviewers using handles from `gh pr view -c`.

### 5. Bot wait trigger (dynamic)

```sh
npm run wait-for-bots
npm run wait-for-bots -- --watch
npm run wait-for-bots -- --bot-tag
```

Run after creating a new PR (or after tagging bots). Exit **2** = still waiting, **0** = ready, **1** = error/timeout.

**Ready when** (since wait anchor — PR creation or `--bot-tag`):

- Required CI checks are not pending, **and**
- At least one configured bot has commented since the anchor, **and**
- Either no bot activity for **90s** (quiet window) **or** every configured bot has posted, **and**
- At least **60s** since anchor (unless cached ready state)

**Safety cap:** **28 minutes**. Tune via env: `BOT_WAIT_POLL_SEC`, `BOT_WAIT_QUIET_SEC`, `BOT_WAIT_MIN_SEC`, `BOT_WAIT_MAX_MIN`, `BOT_WAIT_LOGINS`.

**Orchestrator loop:** re-run until exit **0**. Do **not** proceed to synthesis while exit **2**.

Code fix pushes do **not** restart the wait anchor unless you tagged bots (`--bot-tag`).

### 5b. Synthesize all feedback before responding

After `wait-for-bots` exits 0, before replying to any thread:

1. Fetch ALL threads (`gh pr view`, reviews API, inline comments).
2. **Read every thread before replying to any of them.**
3. Post ONE `## Feedback plan` on the PR: implement / defer / decline per thread.
4. One code push, then in-thread replies.

### 6. Thread closure

Reply in-thread: `implemented in <sha>` / `deferred — <reason>` / `declined — <reason>`. Do NOT merge with unanswered substantive threads.

**Gate:**

```sh
npm run pr:bot-feedback-check -- --pr <n>
```

`npm run ship:closeout:strict` runs this when an open PR exists. CI: **`pr-bot-feedback-check`** workflow.

### 7. Merge

`gh pr merge --squash` — only after steps 5–6 and bot-feedback-check exit **0**.

### 8. Deploy / dev server confirmed

Run `{DEPLOY_COMMAND}` so running code matches `main`.

Examples:

- Local: restart dev server, reload process manager, or `{DEPLOY_COMMAND}` from your README.
- Remote: deploy to `{DEPLOY_URL}` if your project uses hosted acceptance.

Push to `main` does not automatically update long-lived local processes — restart when needed.

### 9. Verify

```sh
{VERIFY_COMMAND}
```

Report exit code. For UI regressions, use **Browser MCP** (`deep-browser-explore` skill) against the acceptance URL.

If exit non-zero: fix, re-run deploy step if needed, repeat until **0**.

---

## Closeout check (before claiming done on a topic branch)

```sh
npm run ship:closeout:strict && npm run wait-for-bots
```

- `ship:closeout:strict` exit **2** → open PR or failed bot-feedback gate; continue steps 5–9.
- `wait-for-bots` exit **2** → bots/CI not settled; re-run until **0**.

---

## Hard rules

Urgency, "just merge", "CI green", and batch-merge phrasing **never** waive steps 5–7.

Only an explicit written waiver for that specific PR waives bot closeout.

## Forbidden completions

While an open PR exists and you can merge: "done", "shipped", "CI green so we're good", "merge-ready", "handing off the PR" without steps 5b–6 complete.

## After merge

`npm run git:graph-hygiene`; delete local topic branch when safe.

## Exception

`main` hotfix (user must explicitly request): push directly to `main`; still do steps **8–9**.
