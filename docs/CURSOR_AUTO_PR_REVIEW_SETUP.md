# Cursor Auto PR Review — superseded

This document is superseded by **[QWEN_PR_REVIEW_SETUP.md](./QWEN_PR_REVIEW_SETUP.md)**.

PR reviews now use a self-hosted OpenAI-compatible **Qwen 3 Coder** endpoint via `scripts/qwen-pr-review.mjs` and the `cursor-auto-pr-review` workflow (check name `qwen-code-review`, marker `<!-- qwen-code-review -->`).

Tag re-reviews with `@qwen-review` before `npm run wait-for-bots -- --bot-tag`.
