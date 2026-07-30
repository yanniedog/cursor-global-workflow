#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$script_dir/lib.sh"

repo_root="$(codex_cloud_repo_root)"
mapfile -t dependency_dirs < <(codex_cloud_dependency_dirs "$repo_root")

if [[ "${#dependency_dirs[@]}" -eq 0 ]]; then
  echo "codex-cloud: no supported lockfiles found; no dependency setup required"
  marker="$(codex_cloud_marker)"
  current_fingerprint="$(codex_cloud_lock_hash "$repo_root")"
  previous_fingerprint="$(cat "$marker" 2>/dev/null || true)"
  if [[ -n "$previous_fingerprint" && "$previous_fingerprint" != v2:0:* ]]; then
    rm -f -- "$marker"
    echo "codex-cloud: lockfiles were removed from a cached environment; start a fresh environment before verification" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$marker")"
  printf '%s\n' "$current_fingerprint" > "$marker"
  echo "codex-cloud: dependency setup complete"
  exit 0
fi

for dependency_dir in "${dependency_dirs[@]}"; do
  relative_dir="${dependency_dir#"$repo_root"/}"
  [[ "$dependency_dir" == "$repo_root" ]] && relative_dir="."
  echo "codex-cloud: preparing $relative_dir"

  pushd "$dependency_dir" >/dev/null

  if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
    codex_cloud_require_command npm "the npm lockfile in $relative_dir"
    npm ci --no-audit --no-fund
  elif [[ -f pnpm-lock.yaml ]]; then
    package_manager=""
    if [[ -f package.json ]]; then
      codex_cloud_require_command node "package.json in $relative_dir"
      package_manager="$(node -p "require('./package.json').packageManager || ''")"
    fi
    if [[ "$package_manager" == pnpm@* ]]; then
      codex_cloud_require_command corepack "the pinned pnpm version in $relative_dir"
      corepack pnpm install --frozen-lockfile
    else
      if ! command -v pnpm >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then
        corepack enable
      fi
      codex_cloud_require_command pnpm "pnpm-lock.yaml in $relative_dir"
      pnpm install --frozen-lockfile
    fi
  elif [[ -f yarn.lock ]]; then
    if ! command -v yarn >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then
      corepack enable
    fi
    codex_cloud_require_command yarn "yarn.lock in $relative_dir"
    yarn_major="$(yarn --version | cut -d. -f1)"
    if [[ "$yarn_major" == "1" ]]; then
      yarn install --frozen-lockfile
    else
      yarn install --immutable
    fi
  elif [[ -f bun.lock || -f bun.lockb ]]; then
    codex_cloud_require_command bun "the Bun lockfile in $relative_dir"
    bun install --frozen-lockfile
  fi

  if [[ -f uv.lock ]]; then
    codex_cloud_require_command uv "uv.lock in $relative_dir"
    uv sync --frozen
  elif [[ -f poetry.lock ]]; then
    codex_cloud_require_command poetry "poetry.lock in $relative_dir"
    poetry install --sync
  elif [[ -f Pipfile.lock ]]; then
    codex_cloud_require_command pipenv "Pipfile.lock in $relative_dir"
    pipenv sync --dev
  else
    mapfile -t requirements_files < <(find . -maxdepth 1 -type f -name 'requirements*.txt' -printf '%f\n' | sort)
    if [[ "${#requirements_files[@]}" -gt 0 ]]; then
      codex_cloud_require_command python "requirements files in $relative_dir"
    fi
    for requirements_file in "${requirements_files[@]}"; do
      python -m pip install -r "$requirements_file"
    done
  fi

  if [[ -f go.mod ]]; then
    codex_cloud_require_command go "go.mod in $relative_dir"
    go mod download
  fi
  if [[ -f Cargo.lock ]]; then
    codex_cloud_require_command cargo "Cargo.lock in $relative_dir"
    cargo fetch --locked
  fi
  if [[ -f Gemfile.lock ]]; then
    codex_cloud_require_command bundle "Gemfile.lock in $relative_dir"
    BUNDLE_FROZEN=true bundle install
  fi
  if [[ -f composer.lock ]]; then
    codex_cloud_require_command composer "composer.lock in $relative_dir"
    composer install --no-interaction --prefer-dist
  fi
  if [[ -f pubspec.lock ]]; then
    if grep -Eq '^[[:space:]]*sdk:[[:space:]]*flutter([[:space:]#]|$)' pubspec.yaml; then
      codex_cloud_require_command flutter "Flutter pubspec.lock in $relative_dir"
      flutter pub get
    else
      codex_cloud_require_command dart "Dart pubspec.lock in $relative_dir"
      dart pub get
    fi
  fi

  popd >/dev/null
done

marker="$(codex_cloud_marker)"
mkdir -p "$(dirname "$marker")"
codex_cloud_lock_hash "$repo_root" > "$marker"
echo "codex-cloud: dependency setup complete"
