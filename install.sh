#!/usr/bin/env bash
# Install cursor-global-workflow to user-global Cursor paths (macOS/Linux).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CURSOR_HOME="${HOME}/.cursor"
SKILLS_DEST="${CURSOR_HOME}/skills"
RULES_DEST="${CURSOR_HOME}/rules"
SCRIPTS_DEST="${CURSOR_HOME}/workflow-scripts"
TEMPLATES_DEST="${SCRIPTS_DEST}/templates"

mkdir -p "$SKILLS_DEST" "$RULES_DEST" "$SCRIPTS_DEST" "$TEMPLATES_DEST"

for skill in "$ROOT"/skills/*/; do
  name="$(basename "$skill")"
  rm -rf "${SKILLS_DEST}/${name}"
  cp -R "$skill" "${SKILLS_DEST}/${name}"
done

cp -f "$ROOT"/rules/*.mdc "$RULES_DEST"/ 2>/dev/null || true

rsync -a --delete "$ROOT/scripts/" "$SCRIPTS_DEST/"
cp -f "$ROOT/hooks/"*.mjs "$SCRIPTS_DEST/" 2>/dev/null || true
cp -f "$ROOT/bootstrap-version.txt" "$SCRIPTS_DEST/"
cp -R "$ROOT/templates/." "$TEMPLATES_DEST/"

export_line="export CURSOR_WORKFLOW_SCRIPTS=\"${SCRIPTS_DEST}\""
for rc in "${HOME}/.bashrc" "${HOME}/.zshrc"; do
  if [[ -f "$rc" ]] && ! grep -q 'CURSOR_WORKFLOW_SCRIPTS' "$rc" 2>/dev/null; then
    echo "" >> "$rc"
    echo "$export_line" >> "$rc"
  fi
done

HOOKS_PATH="${CURSOR_HOME}/hooks.json"
node - "$SCRIPTS_DEST" "$HOOKS_PATH" <<'NODE'
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const scriptsDest = process.argv[2].replace(/\\/g, '/');
const hooksPath = process.argv[3];
const base = { version: 1, hooks: {} };

if (existsSync(hooksPath)) {
  try {
    const existing = JSON.parse(readFileSync(hooksPath, 'utf8'));
    if (existing.version) base.version = existing.version;
    if (existing.hooks && typeof existing.hooks === 'object') {
      for (const [k, v] of Object.entries(existing.hooks)) base.hooks[k] = v;
    }
  } catch {
    /* replace entries below */
  }
}

base.hooks.sessionStart = [
  { command: `node "${scriptsDest}/repo-auto-bootstrap.mjs"`, loop_limit: 1 },
];
base.hooks.subagentStop = [
  { command: `node "${scriptsDest}/orchestrator-remind.mjs"`, loop_limit: 2 },
];
base.hooks.stop = [
  { command: `node "${scriptsDest}/orchestrator-remind.mjs"`, loop_limit: 2 },
];

writeFileSync(hooksPath, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
NODE

echo "Installed skills  -> $SKILLS_DEST"
echo "Installed rules   -> $RULES_DEST"
echo "Installed scripts -> $SCRIPTS_DEST"
echo "Installed templates -> $TEMPLATES_DEST"
echo "Registered user hooks -> $HOOKS_PATH"
echo "Add to your shell profile if needed: $export_line"
