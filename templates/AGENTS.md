# {PROJECT_NAME} agent instructions

## Verification

- Primary verification: `{VERIFY_COMMAND}`
- Keep repository-specific setup and CI deterministic.

## Pull requests

- Branch from the current default branch and open every PR against that default branch.
- Run `npm run pr:arm-and-park -- --pr <n>` once after each push.
- Exit 2 means CI is still settling; keep ownership without agent-side watch or sleep-poll loops.
- Squash merge only; auto-merge and head-branch deletion stay enabled.

Review vendors are advisory. Qwen/local-LLM and `bot-presence-gate` are disabled
by default and must not be required status checks. Repository CI and
`bot-feedback-gate` are required. Every substantive human or bot thread still
needs an explicit `Implemented`, `Deferred`, or `Declined` reply and GitHub
resolution. Audit late feedback after merge with `npm run pr:bot-feedback-audit`.
