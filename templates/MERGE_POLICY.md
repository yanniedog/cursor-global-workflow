# Merge policy

All PRs target the default branch and use squash auto-merge.

```sh
npm run pr:arm-and-park -- --pr <n>
```

The command verifies the default base, syncs when safe, and arms
`--auto --squash --delete-branch`. Never replace it with a hand-written merge
command because that bypasses the default-base guard.

Repository settings:

- squash merges on; merge commits and rebase merges off;
- auto-merge and automatic head-branch deletion on;
- strict, admin-enforced default-branch protection;
- deterministic repository CI plus `bot-feedback-gate` required;
- conversation resolution required;
- force-push and protected-branch deletion off;
- reviewer presence, Qwen/local-LLM, and external vendors advisory.

Apply settings with:

```sh
npm run repo-merge-settings:apply
npm run branch-protection:apply
```
