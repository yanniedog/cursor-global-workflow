#!/usr/bin/env bash
# Install cursor-global-workflow to user-global Cursor paths (macOS/Linux).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CURSOR_HOME="${HOME}/.cursor"
SKILLS_DEST="${CURSOR_HOME}/skills"
RULES_DEST="${CURSOR_HOME}/rules"
SCRIPTS_DEST="${CURSOR_HOME}/workflow-scripts"

mkdir -p "$SKILLS_DEST" "$RULES_DEST" "$SCRIPTS_DEST"

for skill in "$ROOT"/skills/*/; do
  name="$(basename "$skill")"
  rm -rf "${SKILLS_DEST}/${name}"
  cp -R "$skill" "${SKILLS_DEST}/${name}"
done

cp -f "$ROOT"/rules/*.mdc "$RULES_DEST"/ 2>/dev/null || true

rsync -a --delete "$ROOT/scripts/" "$SCRIPTS_DEST/"

export_line="export CURSOR_WORKFLOW_SCRIPTS=\"${SCRIPTS_DEST}\""
for rc in "${HOME}/.bashrc" "${HOME}/.zshrc"; do
  if [[ -f "$rc" ]] && ! grep -q 'CURSOR_WORKFLOW_SCRIPTS' "$rc" 2>/dev/null; then
    echo "" >> "$rc"
    echo "$export_line" >> "$rc"
  fi
done

echo "Installed skills  -> $SKILLS_DEST"
echo "Installed rules   -> $RULES_DEST"
echo "Installed scripts -> $SCRIPTS_DEST"
echo "Add to your shell profile if needed: $export_line"
