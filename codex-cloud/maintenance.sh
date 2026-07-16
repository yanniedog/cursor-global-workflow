#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$script_dir/lib.sh"

repo_root="$(codex_cloud_repo_root)"
marker="$(codex_cloud_marker)"
expected="$(codex_cloud_lock_hash "$repo_root")"
actual="$(cat "$marker" 2>/dev/null || true)"

if [[ "$actual" == "$expected" ]]; then
  echo "codex-cloud: cached dependencies are current ($expected)"
  exit 0
fi

echo "codex-cloud: lockfiles changed; refreshing dependencies"
exec bash "$script_dir/setup.sh"
