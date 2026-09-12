# Codex Cloud repository baseline

This directory is the portable source for preparing repositories for Codex Cloud. It deliberately does not contain local Codex credentials, MCP configuration, workstation paths, deployment credentials, or GitHub tokens.

## Environment settings

Create one environment per repository in [Codex environment settings](https://chatgpt.com/codex/settings/environments):

- Pin the runtime versions already used by the repository's CI.
- Set the setup command to `bash .codex/cloud/setup.sh`.
- Set the maintenance command to `bash .codex/cloud/maintenance.sh`.
- Leave agent internet access off unless a documented task requires a narrow read-only allowlist.
- Add no secrets for public repositories. For private package installation, use only a setup-time read token scoped to that package and ensure setup leaves no credential file behind.

The setup script discovers lockfiles no deeper than three directories and installs dependencies with frozen or locked package-manager commands. The maintenance script hashes the lockfile set and re-runs setup only when the cached dependencies are stale.

Repository-specific setup is preferable when the generic discovery would install unrelated workspaces. Replace the generated scripts with explicit commands and keep their interface stable.

## Existing repository onboarding

1. On Windows, run `scripts/bootstrap-codex-cloud.ps1 -RepoPath <path>` from this repository. On Linux, run the following from this repository after setting `target` to the existing repository path. Existing baseline files are preserved:

   ```sh
   target=/path/to/existing/repository
   git -C "$target" rev-parse --show-toplevel || exit
   mkdir -p "$target/.codex/cloud"
   for file in lib.sh setup.sh maintenance.sh; do
     if [ ! -e "$target/.codex/cloud/$file" ]; then
       cp "codex-cloud/$file" "$target/.codex/cloud/$file" || exit
     fi
   done
   ```

   The `.codex/cloud/` environment commands above apply to the installed target. In this source repository, use `bash codex-cloud/setup.sh` and `bash codex-cloud/maintenance.sh`.
2. Add or refine the root `AGENTS.md` with exact ownership boundaries and verification commands.
3. Confirm the default branch requires a pull request, passing CI, resolved conversations, and disallows force-push and deletion without an app/admin bypass.
4. Grant the Codex GitHub App access to this repository.
5. Create the environment with the settings above.
6. Run a read-only canary that reports the branch/SHA and runtime versions and then executes the documented verification command.
7. Run a small code canary that creates a `codex/*` branch and pull request. Confirm it cannot push to the default branch, merge, deploy, or change repository settings.
8. Resume the environment while cached and confirm maintenance is fast and idempotent.

Do not enable write-capable Cloud work until steps 1-8 pass. Archived repositories, upstream forks, and repositories without a default branch should remain disabled unless they are deliberately reactivated.

## Future repositories

Use the files in this directory as a GitHub repository-template seed. A future repository is Cloud-ready only after it has:

- a default branch and root `AGENTS.md`;
- committed lockfiles and deterministic setup;
- one exact CI/verification command;
- pull-request protection and required CI on the default branch;
- a Cloud environment and successful read/code canaries;
- a documented network and secrets policy.

Codex environment creation is currently an account-level, per-repository action. Repository files can make onboarding repeatable, but cannot pre-create an environment for a repository that does not exist.

## Secret and deployment boundary

Codex Cloud setup secrets are only for fetching dependencies. Never provide Android signing material, Firebase administration credentials, Cloudflare deployment tokens, SSH/Tailscale credentials, release tokens, production API keys, or a broad GitHub personal access token. Builds, signing, deployment, publication, and merging stay in protected CI or explicit human-controlled workflows.

Official references: [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment), [agent internet access](https://learn.chatgpt.com/docs/cloud/internet-access), [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), and [GitHub integration](https://learn.chatgpt.com/docs/third-party/github).
