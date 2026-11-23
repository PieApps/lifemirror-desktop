# LifeMirror Desktop: Development & Production Environment Isolation

This document describes how LifeMirror Desktop achieves complete runtime and data isolation between installed production builds and local development versions, allowing both to run simultaneously on the same machine without conflict.

---

## 1. Quickstart: Running Environments

### Running Production
The production package is installed via system packages (`.deb`, `.rpm`, or Windows installer).
```bash
# Production executable
/usr/bin/lifemirror-desktop
# Or launch from application menu / autostart
```
- **Identifier**: `com.lifemirror.desktop`
- **Window Title**: `LifeMirror Desktop`
- **System Tray**: `LifeMirror Desktop`

### Running Development Alongside Production
To start development mode without closing the installed production application:
```bash
npm run tauri:dev
```
- **Identifier**: `com.lifemirror.desktop.dev`
- **Window Title**: `LifeMirror Desktop (Dev)`
- **Header UI**: Distinct amber `[DEV]` badge next to the app name
- **System Tray**: `LifeMirror Desktop (Dev)`

Both applications will run side-by-side with separate windows, independent system tray icons, and separate local data.

---

## 2. Environment Detection Architecture

Environment detection is centralized in Rust via `crate::env::AppEnvironment` (`src-tauri/src/env.rs`).

The resolution order is strictly prioritized:

1. **Environment Variable Override (`LIFEMIRROR_ENV`)**:
   - `LIFEMIRROR_ENV=development` or `dev` -> `AppEnvironment::Development`
   - `LIFEMIRROR_ENV=production` or `prod` -> `AppEnvironment::Production`
   - `LIFEMIRROR_ENV=testing` or `test` -> `AppEnvironment::Testing`
2. **Tauri Config Application Identifier**:
   - If the runtime identifier ends with `.dev` (configured in `tauri.dev.conf.json`), it resolves to `AppEnvironment::Development`.
   - If the identifier ends with `.test`, it resolves to `AppEnvironment::Testing`.
3. **Build Profile Fallback**:
   - `cfg!(test)` -> `AppEnvironment::Testing`
   - `cfg!(debug_assertions)` -> `AppEnvironment::Development`
   - Release build -> `AppEnvironment::Production`

A Tauri command `get_app_environment` is exposed to allow the frontend or plugins to query the runtime environment.

---

## 3. Storage and Database Locations

All persistent state, encryption keys, and SQLite files are strictly partitioned by environment:

| Resource | Production | Development | Testing |
| :--- | :--- | :--- | :--- |
| **Data Directory (Linux)** | `~/.local/share/lifemirror-desktop/` | `~/.local/share/lifemirror-dev/` | `~/.local/share/lifemirror-test/` |
| **Data Directory (Windows)** | `%LOCALAPPDATA%\lifemirror-desktop\` | `%LOCALAPPDATA%\lifemirror-dev\` | `%LOCALAPPDATA%\lifemirror-test\` |
| **Database File** | `lifemirror-desktop.db` | `lifemirror-desktop-dev.db` | `lifemirror-test.db` |
| **Concurrency Lock** | `.vault.lock` in production dir | `.vault.lock` in dev dir | `.vault.lock` in test dir |
| **Key Mirror File** | `.vault_key` in production dir | `.vault_key` in dev dir | `.vault_key` in test dir |
| **Backups & Staging** | Stored within production dir | Stored within dev dir | Stored within test dir |
| **OS Keyring Service** | `com.lifemirror.desktop` | `com.lifemirror.desktop.dev` | `com.lifemirror.desktop.test` |
| **Knowledge Vault (Notes)**| `~/Documents/LifeMirror Vault` | `~/Documents/LifeMirror Vault (Dev)` | `LifeMirror Vault (Test)` |
| **Webview Storage / Cache**| `~/.local/share/com.lifemirror.desktop` | `~/.local/share/com.lifemirror.desktop.dev` | `~/.local/share/com.lifemirror.desktop.test` |

### Keyring Isolation & Guardrail Invariant
`OsKeyStore` dynamically sets its service name according to `env.keyring_service()`.
This prevents the development vault from reading or modifying the production encryption key in the system keyring (GNOME Keyring / KWallet / Windows Credential Manager).
Crucially, this also ensures that the first-launch guardrail (`check_first_launch_guardrail`) does not falsely detect production credentials when initializing a fresh development database, avoiding anomalous startup errors.

---

## 4. Background Services and Monitoring Isolation

1. **Single-Instance Plugin**:
   `tauri-plugin-single-instance` binds to the unique application identifier (`com.lifemirror.desktop` vs `com.lifemirror.desktop.dev`). Starting development does not send focus events to or kill the running production app.
2. **OS Window Focus Tracker**:
   The window focus tracking loop queries OS-level window titles (via Hyprland, Sway, or X11/Win32 APIs) in a read-only manner. Both applications can independently track focus and log to their respective databases without collision.
3. **Chrome / Brave Native Messaging Host**:
   In Development, the automatic Native Messaging manifest installation is explicitly bypassed (`should_register_native_host() == false`). This guarantees that the installed production application retains permanent, uninterrupted ownership of the browser companion extension.
4. **Toast Notifications**:
   Distraction toast reminder windows are distinct (`toast` label with title `Distraction Reminder (Dev)`). Each application monitors its own rules and displays its own toast without interfering with the other.
5. **System Tray**:
   Each instance creates an independent tray icon with its own menu and tooltip (`LifeMirror Desktop` vs `LifeMirror Desktop (Dev)`). Quitting one application from its tray does not terminate the other.

---

## 5. Importing & Merging Production Data into Development

To test development features with realistic working data from your production environment without risking production data:

```bash
npm run dev:merge-data
# or alias:
npm run dev:import-prod
```

### What this tool does:
1. **Reads Production in Read-Only Mode**: Locates `~/.local/share/lifemirror-desktop/` (or `%LOCALAPPDATA%\lifemirror-desktop`) and leaves the production database untouched.
2. **Backs Up Existing Dev Data**: If a development database already exists, it creates a timestamped backup before importing.
3. **Replicates Database & Credentials**: Copies the encrypted database to `lifemirror-desktop-dev.db`, replicates WAL/SHM consistency journals, and mirrors `.vault_key` so development automatically unlocks it with dev's keyring.
4. **Knowledge Vault Sync**: Automatically syncs markdown session and project notes from `~/Documents/LifeMirror Vault` to `~/Documents/LifeMirror Vault (Dev)` without overwriting existing dev notes.
5. **Locks Cleanup**: Cleans up any stale development lock files.

After running the command, start development normally with `npm run tauri:dev`. Any changes made during testing remain 100% confined to the development environment.

---

## 6. Resetting Development Data

To safely wipe and reset all development data cross-platform without touching production data:

```bash
# Reset development database and webview cache
npm run dev:reset-data

# Or reset both database and dev Knowledge Vault notes:
node scripts/reset-dev-data.mjs --all
```

Production user data in `~/.local/share/lifemirror-desktop` will remain completely unaffected. The reset tool includes safety assertions that actively refuse to delete any directory matching the production application name.

---

## 6. Architecture Limitations & Edge Cases

- **Chrome Companion Extension**: Because Chrome connects to a single native messaging host identified by `com.lifemirror.desktop`, browser tab focus events will flow exclusively to the production instance when both are running.
- **System Tray Icon Density**: Running multiple instances creates two system tray icons. Look for the `(Dev)` tooltip or menu entry to distinguish the development icon.
