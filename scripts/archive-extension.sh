#!/usr/bin/env bash
# LifeMirror Companion Extension Shell Archiver Wrapper
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Execute the cross-platform Node.js packager
node "$SCRIPT_DIR/archive-extension.mjs" "$@"

