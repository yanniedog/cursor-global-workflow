#!/usr/bin/env bash

codex_cloud_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd -P
}

codex_cloud_lockfiles() {
  local repo_root="$1"
  find "$repo_root" -maxdepth 3 -type f \
    \( -name package-lock.json -o -name npm-shrinkwrap.json \
       -o -name pnpm-lock.yaml -o -name yarn.lock \
       -o -name bun.lock -o -name bun.lockb \
       -o -name uv.lock -o -name poetry.lock -o -name Pipfile.lock \
       -o -name 'requirements*.txt' -o -name go.sum -o -name Cargo.lock \
       -o -name Gemfile.lock -o -name composer.lock -o -name pubspec.lock \) \
    -not -path '*/.git/*' -not -path '*/node_modules/*' \
    -not -path '*/vendor/*' -not -path '*/.venv/*' -print0
}

codex_cloud_setup_files() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  find "$script_dir" -maxdepth 1 -type f -name '*.sh' -print0
}

codex_cloud_cache_inputs() {
  local repo_root="$1"
  {
    codex_cloud_lockfiles "$repo_root"
    codex_cloud_setup_files
  } | sort -zu
}

codex_cloud_lock_hash() {
  local repo_root="$1"
  codex_cloud_cache_inputs "$repo_root" \
    | xargs -0 -r sha256sum \
    | sha256sum \
    | awk '{print $1}'
}

codex_cloud_dependency_dirs() {
  local repo_root="$1"
  local file
  while IFS= read -r -d '' file; do
    dirname "$file"
  done < <(codex_cloud_lockfiles "$repo_root") | sort -u
}

codex_cloud_marker() {
  printf '%s/codex-cloud/lockset.sha256\n' "${XDG_CACHE_HOME:-$HOME/.cache}"
}

codex_cloud_require_command() {
  local command_name="$1"
  local context="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "codex-cloud: $command_name is required for $context" >&2
    return 1
  fi
}
