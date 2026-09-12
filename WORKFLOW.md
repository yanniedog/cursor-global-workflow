# Workflow — {PROJECT_NAME}

Canonical PR ship bar. Repository-specific instructions may add product checks
and deployment steps but must not weaken this policy.

## 1. Branch from the current default branch

Fetch first, create a distinctive topic branch, and never reuse another
agent's in-flight branch.

## 2. Commit and push

Commit only the intended files. Push the topic branch with tracking.

## 3. Open a draft PR against the default branch

Never stack a PR onto a feature branch. Required checks protect the default
branch, so a weaker base can merge unreviewed. Several PRs may run in parallel
against the default branch.

## 4. Required CI

Repository CI and `bot-feedback-gate` are merge-blocking. Use a single
`gh pr checks <n> --required` read for diagnosis. Agents do not run `--watch`
or sleep-poll loops.

## 5. Advisory reviewers

CodeRabbit, Codex, Cursor, Sourcery, Qwen/local-LLM, and other review vendors
are advisory. Vendor quota, installation state, or an offline runner never
controls merge liveness. `bot-presence-gate` stays disabled by default.

`npm run wait-for-bots -- --pr <n>` therefore checks required CI settlement
when `BOT_WAIT_REQUIRED=off`: exit 0 ready, 2 waiting, 1 hard error. An owner
may explicitly opt a repository into reviewer presence, but generated
repositories never do so.

## 6. Feedback synthesis and closure

**babysit skill etc must always address PR bot feedback where appropriate.**

Read every human and bot thread before replying. Post one `## Feedback plan`,
make one implementation push for accepted findings, then reply in-thread with
`Implemented`, `Deferred`, or `Declined` plus evidence or rationale. Resolve
every substantive thread. Advisory reviewers still require that disposition;
green CI does not replace it.

```sh
npm run pr:bot-feedback-check -- --pr <n>
```

`bot-feedback-gate` re-evaluates review events on the PR head and remains
required. Required conversation resolution supplies the native backstop.

## 7. Arm and park

```sh
npm run pr:arm-and-park -- --pr <n>
```

This one-shot command verifies the PR targets the default branch, syncs when
safe, arms squash auto-merge with head-branch deletion, and classifies:

- exit 0 — gates green;
- exit 2 — CI is still settling; keep ownership without polling;
- exit 3 — fix CI, conflicts, or review threads, push, and run it once again;
- exit 1 — hard tooling/auth error.

`npm run pr:merge` enforces the same default-base guard. Never route around
the guard with a hand-written auto-merge command.

## 8. Deploy or restart

Run `{DEPLOY_COMMAND}` so the active runtime matches the merged default branch.

## 9. Verify

Run `{VERIFY_COMMAND}` against `{DEPLOY_URL}` when applicable. Report the
current exit code and production evidence; fix forward until it passes.

## Repository settings

The default branch uses strict, admin-enforced protection with deterministic
repository CI plus `bot-feedback-gate`, pull requests, stale-review dismissal,
and required conversation resolution. Force-push and branch deletion are
blocked. Repositories allow squash merges only, enable auto-merge, and delete
merged head branches.

Apply or reconcile:

```sh
npm run repo-merge-settings:apply
npm run branch-protection:apply
```

Qwen/local-LLM, `bot-presence-gate`, and external vendors are never required
by the default profile.

## Late feedback

Advisory reviewers can arrive after a fast merge. Run
`npm run pr:bot-feedback-audit` during backlog hygiene and fix every
substantive late thread in a follow-up PR.

## Exception

A direct default-branch hotfix requires an explicit user instruction for that
specific change and does not waive deployment or verification.
