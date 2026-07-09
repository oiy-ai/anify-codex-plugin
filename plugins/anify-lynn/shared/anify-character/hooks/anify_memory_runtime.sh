#!/usr/bin/env sh
set -eu

codex_home="${CODEX_HOME:-$HOME/.codex}"
runtime_python="$codex_home/anify/runtime/python/bin/python"

if [ ! -x "$runtime_python" ]; then
  cat <<'EOF'
Anify long-term memory is not deployed on this machine. Run Anify Installer before using character memory. No legacy Markdown memory fallback is loaded.
EOF
  exit 0
fi

exec "$runtime_python" "${PLUGIN_ROOT}/shared/anify-character/hooks/anify_character_hooks.py" "$@"
