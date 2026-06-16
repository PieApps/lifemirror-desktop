#!/usr/bin/env bash
# LifeMirror Native Messaging Host Installer & Diagnostics
# Run this script whenever you reload the extension or rebuild the binary.
set -e

MANIFEST_SRC="/var/www/pieapps/lifemirror-desktop/companion-extension/com.lifemirror.desktop.json"
CHROME_HOST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
CHROMIUM_HOST_DIR="$HOME/.config/chromium/NativeMessagingHosts"
BINARY_PATH="/var/www/pieapps/lifemirror-desktop/src-tauri/target/debug/lifemirror"

echo "======================================================"
echo " LifeMirror Native Messaging Host - Install & Diagnose"
echo "======================================================"

# ── 1. Verify the binary exists and is executable ──────────────────────────────
echo ""
echo "▶ Checking binary..."
if [ -f "$BINARY_PATH" ]; then
    echo "  ✅ Binary found: $BINARY_PATH"
    chmod +x "$BINARY_PATH"
    echo "  ✅ Executable bit set"
else
    echo "  ❌ Binary NOT found at: $BINARY_PATH"
    echo "     Run: cd /var/www/pieapps/lifemirror-desktop && cargo tauri dev"
    echo "     (or: cargo build inside src-tauri)"
    exit 1
fi

# ── 2. Install manifest for Google Chrome ──────────────────────────────────────
echo ""
echo "▶ Installing manifest for Google Chrome..."
mkdir -p "$CHROME_HOST_DIR"
cp "$MANIFEST_SRC" "$CHROME_HOST_DIR/com.lifemirror.desktop.json"
echo "  ✅ Installed to: $CHROME_HOST_DIR/com.lifemirror.desktop.json"

# ── 3. Install manifest for Chromium (if present) ────────────────────────────
if [ -d "$HOME/.config/chromium" ]; then
    echo ""
    echo "▶ Chromium detected — installing there too..."
    mkdir -p "$CHROMIUM_HOST_DIR"
    cp "$MANIFEST_SRC" "$CHROMIUM_HOST_DIR/com.lifemirror.desktop.json"
    echo "  ✅ Installed to: $CHROMIUM_HOST_DIR/com.lifemirror.desktop.json"
fi

# ── 4. Show the installed manifest ────────────────────────────────────────────
echo ""
echo "▶ Installed manifest contents:"
cat "$CHROME_HOST_DIR/com.lifemirror.desktop.json"

# ── 5. Smoke-test: pipe a fake tab event to the binary ────────────────────────
echo ""
echo "▶ Smoke-testing native host binary (piping a mock tab event)..."
PAYLOAD='{"event":"tab_activity","url":"https://example.com","title":"Example","favIconUrl":"","timestamp":1718000000000}'
PAYLOAD_LEN=${#PAYLOAD}

# Build 4-byte little-endian length prefix + JSON payload
python3 -c "
import sys, struct, json
payload = '$PAYLOAD'
data = payload.encode('utf-8')
sys.stdout.buffer.write(struct.pack('<I', len(data)) + data)
" | timeout 3 "$BINARY_PATH" "chrome-extension://hcpagmeofngagbmahpccoajilpndckab/" 2>&1 && echo "  ✅ Binary processed the message (check DB for a new entry)" || echo "  ⚠️  Binary exited (may be normal if it flushed and closed)"

# ── 6. Quick DB check ─────────────────────────────────────────────────────────
DB_PATH="$HOME/.local/share/lifemirror/lifemirror.db"
echo ""
echo "▶ Checking browser_tab_events in DB..."
if [ -f "$DB_PATH" ]; then
    ROW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM browser_tab_events;" 2>/dev/null || echo "table missing")
    echo "  📊 browser_tab_events row count: $ROW_COUNT"
    LATEST=$(sqlite3 "$DB_PATH" "SELECT timestamp, title, url FROM browser_tab_events ORDER BY id DESC LIMIT 3;" 2>/dev/null || echo "none")
    echo "  📋 Latest 3 entries:"
    echo "$LATEST" | sed 's/^/     /'
else
    echo "  ⚠️  DB not found at $DB_PATH (app may not have run yet)"
fi

echo ""
echo "======================================================"
echo " Done! Next steps:"
echo "   1. Reload the Chrome extension at chrome://extensions"
echo "   2. Click 'Service Worker' inspect link → check Console for errors"
echo "   3. Browse a few tabs, then refresh the LifeMirror app"
echo "======================================================"
