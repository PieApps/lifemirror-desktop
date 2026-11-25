# LifeMirror Desktop - Tauri MCP Server Configuration

This guide provides the exact configuration required to connect Antigravity (or Claude Code / Cursor) to LifeMirror Desktop during local development.

---

## ⚠️ Important Note on Antigravity Settings
Coding agents cannot directly mutate Antigravity's global application settings file. You will need to copy and paste the JSON configuration snippet below into your Antigravity MCP settings (or `mcp.json`).

---

## 1. MCP Server Configuration JSON

Paste this into your MCP client settings (e.g. `mcp.json` or Antigravity Settings -> MCP):

```json
{
  "mcpServers": {
    "tauri-mcp": {
      "command": "/home/raviousprime/.nvm/versions/node/v22.14.0/bin/node",
      "args": [
        "/var/www/pieapps/lifemirror-desktop/tools/tauri-mcp/mcp-server-ts/build/index.js"
      ],
      "env": {
        "TAURI_MCP_CONNECTION_TYPE": "ipc",
        "TAURI_MCP_IPC_PATH": "/tmp/lifemirror-mcp.sock"
      }
    }
  }
}
```

*Note: If `/home/raviousprime/.nvm/versions/node/v22.14.0/bin/node` is already in your global PATH, `"command": "node"` can also be used.*

---

## 2. Dev Mode Startup Instructions

To launch LifeMirror Desktop in debug mode using an isolated, throwaway data directory:

```bash
# 1. Create a dedicated throwaway directory for the agent test
export LIFEMIRROR_DATA_DIR=/tmp/lifemirror-throwaway-data
mkdir -p "$LIFEMIRROR_DATA_DIR"

# 2. Launch the desktop app in development mode
# Note: scripts/tauri-cli.mjs automatically activates the `dev-mcp` cargo feature in dev mode.
npm run tauri:dev
```

When the app boots, the plugin outputs:
```text
[TAURI_MCP] Socket server will use custom IPC path: /tmp/lifemirror-mcp.sock
[TAURI_MCP] Socket server will start automatically
[TAURI_MCP] IPC listener running on: /tmp/lifemirror-mcp.sock
```

The MCP server will connect to `/tmp/lifemirror-mcp.sock` and expose the automation tools:
- `ping`: Verify socket connection
- `manage_window`: List, focus, resize, or control windows
- `take_screenshot`: Capture visual state of webview windows
- `get_dom`: Retrieve complete DOM tree from the webview
- `get_element_position`: Locate elements by selector and trigger clicks (`shouldClick: true`)
- `send_text_to_element`: Type text directly into inputs/elements
- `execute_js`: Run JavaScript within the app context
- `manage_local_storage`: Read and modify `localStorage`

---

## 3. Production Isolation Guarantee

The plugin is strictly gated under:
- `#[cfg(all(debug_assertions, feature = "dev-mcp"))]` in Rust (`src-tauri/src/lib.rs`).
- `tauri-plugin-mcp = { path = "../tools/tauri-mcp", optional = true }` in `src-tauri/Cargo.toml`.
- Capability `"dev-mcp"` is defined exclusively in `src-tauri/tauri.dev.conf.json`. Production (`tauri.conf.json`) only allows `"default"`.
- `LIFEMIRROR_DATA_DIR` is ignored completely in release builds (`#[cfg(debug_assertions)]`), guaranteeing real user data is never redirected or exposed.
