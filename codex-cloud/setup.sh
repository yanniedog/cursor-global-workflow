#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$script_dir/lib.sh"

repo_root="$(codex_cloud_repo_root)"
mapfile -t dependency_dirs < <(codex_cloud_dependency_dirs "$repo_root")

if [[ "${#dependency_dirs[@]}" -eq 0 ]]; then
  echo "codex-cloud: no supported lockfiles found; no dependency setup required"
fi

for dependency_dir in "${dependency_dirs[@]}"; do
  relative_dir="${dependency_dir#"$repo_root"/}"
  [[ "$dependency_dir" == "$repo_root" ]] && relative_dir="."
  echo "codex-cloud: preparing $relative_dir"

  pushd "$dependency_dir" >/dev/null

  if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
    npm ci --no-audit --no-fund
  elif [[ -f pnpm-lock.yaml ]]; then
    corepack enable
    pnpm install --frozen-lockfile
  elif [[ -f yarn.lock ]]; then
    corepack enable
    yarn_major="$(yarn --version | cut -d. -f1)"
    if [[ "$yarn_major" == "1" ]]; then
      yarn install --frozen-lockfile
    else
      yarn install --immutable
    fi
  elif [[ -f bun.lock || -f bun.lockb ]]; then
    bun install --frozen-lockfile
  fi

  if [[ -f uv.lock ]]; then
    uv sync --frozen
  elif [[ -f poetry.lock ]]; then
    poetry install --sync
  elif [[ -f Pipfile.lock ]]; then
    pipenv sync --dev
  else
    for requirements_file in requirements.txt requirements-dev.txt requirements-test.txt; do
      if [[ -f "$requirements_file" ]]; then
        python -m pip install -r "$requirements_file"
      fi
    done
  fi

  [[ -f go.sum ]] && go mod download
  [[ -f Cargo.lock ]] && cargo fetch --locked
  [[ -f Gemfile.lock ]] && bundle install
  [[ -f composer.lock ]] && composer install --no-interaction --prefer-dist
  [[ -f pubspec.lock ]] && flutter pub get

  popd >/dev/null
done

marker="$(codex_cloud_marker)"
mkdir -p "$(dirname "$marker")"
codex_cloud_lock_hash "$repo_root" > "$marker"
echo "codex-cloud: dependency setup complete"
