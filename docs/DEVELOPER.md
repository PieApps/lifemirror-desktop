# 🛠️ LifeMirror Desktop: Developer Documentation

This document describes the architectural layout, core technical implementations, data interfaces, and mathematical formulations powering the LifeMirror Desktop application.

---

## 1. System Architecture & Component Interactions

LifeMirror Desktop uses a local-first, zero-port architecture. It consists of the main Tauri 2.0 application GUI process, a native OS active window focus polling thread, and browser-initiated headless subprocesses spawned via Google Chrome/Firefox Native Messaging API.

```
                           +------------------------+
                           |   Google Chrome / FF   |
                           |   (Active Tab Hook)    |
                           +-----------+------------+
                                       | Native Messaging
                                       | (Secure STDIN Pipe)
                                       v
+------------------+       +-----------+------------+
|  Native OS Focus |       |   Headless Tauri CLI   |
|  Polling Thread  |       |  (native_msg module)   |
+--------+---------+       +-----------+------------+
         |                             |
         | Writes Logs                 | Writes Logs
         |                             |
         |      +---------------+      |
         +----->| Encrypted DB  |<-----+
                | (SQLCipher)   |
                +-------+-------+
                        ^
                        | Reads Logs
                        |
            +-----------+-----------+
            |  Main Tauri GUI App   |
            | (React + SVG S-Curve) |
            +-----------------------+
```

---

## 2. Database Schema & Security (`db.rs`)

We use Cloud-isolated SQLite with page-level **SQLCipher** encryption enabled via the `rusqlite` crate:
```toml
rusqlite = { version = "0.31", features = ["bundled-sqlcipher-vendored-openssl"] }
```

### Table 1: `activity_logs`
Stores time-slice focus events captured natively or piped from browser extensions.
* `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
* `app_name`: `TEXT NOT NULL` (e.g. `"Code"`, `"Chrome"`)
* `window_title`: `TEXT NOT NULL`
* `start_time`: `TEXT NOT NULL` (ISO 8601 string)
* `duration`: `INTEGER NOT NULL` (Session duration in seconds)
* `source`: `TEXT NOT NULL` (`"OS"` or `"Browser"`)
* `url`: `TEXT` (Nullable, populated for browser events)

### Table 2: `settings`
Persistent configuration store shared across processes (Tauri GUI and CLI Native Messaging Hosts).
* `key`: `TEXT PRIMARY KEY`
* `value`: `TEXT NOT NULL`

### Table 3: `journal_entries`
Stores user-written reflections.
* `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
* `timestamp`: `TEXT NOT NULL` (ISO 8601 string)
* `notes`: `TEXT NOT NULL`

---

## 3. Browser Native Messaging Bridge (`native_msg.rs`)

Browser tab synchronization operates via Chrome's Native Messaging API instead of exposing network sockets. 
* **Registry Host Config (`com.lifemirror.desktop.json`)**: Configured with `"type": "stdio"` mapping to the Tauri binary.
* **Stream Protocol:** Stdin payloads are prefixed with a **4-byte native-endian unsigned integer** defining the length of the trailing UTF-8 JSON message:
  ```json
  {
    "event": "tab_activity",
    "url": "https://github.com/...",
    "title": "Tauri Repository",
    "timestamp": 1718330000
  }
  ```
* **Security & Incognito:** Before executing `INSERT` statements, the headless native messaging CLI loops query the `settings` database table. If `incognito` is `"true"`, all writes are immediately discarded to prevent data leaks.

---

## 4. Linux Wayland active window focus check (`tracker.rs`)

Under Linux systems runningWayland, standard X11 focus queries (such as `xdotool` or `active-win-pos-rs` native X11 connections) fail due to window isolation sandboxing. To resolve this, the tracker identifies the compositor framework and falls back to compositor CLI utilities:

1. **Hyprland:** Spawns `hyprctl activewindow -j` and parses the output JSON:
   ```json
   {
     "class": "code",
     "title": "main.rs - tauri-app",
     ...
   }
   ```
2. **Sway:** Spawns `swaymsg -t get_tree` and performs a Depth-First Search (DFS) to locate the node containing `"focused": true` and extracts its `"app_id"` and `"name"`.
3. **X11 Fallback:** If not on Wayland, uses `active-win-pos-rs` with shell execution fallbacks to `xdotool`.

---

## 5. Responsive S-Curve Geometry (`SCurveTimeline.tsx`)

The dashboard timeline is represented as an S-shaped serpentine path generated programmatically in the React SVG container.

### Bézier Path Formula
For each activity index `i` (representing an item in the chronological log), a cubic Bézier curve segment is generated from `yStart = i * rowHeight` to `yEnd = (i + 1) * rowHeight` centered around `width = 800`.
The curve equation parameters are:
$$d += \text{C } cpX_1 \quad (yStart + rowHeight/4), \quad cpX_2 \quad (yEnd - rowHeight/4), \quad \frac{width}{2} \quad yEnd$$

Where control coordinates sweep left/right based on alternate odd/even indices:
* `cpX1 = cpX2 = (i % 2 === 0) ? width - 50 : 50`

### MIDPOINT Node coordinates ($t = 0.5$)
Interactive nodes are positioned along the curve peaks. Evaluated at the parametric midpoint $t=0.5$ of the cubic Bézier curve, the node anchors sit exactly at:
* $y = (i + 0.5) \times rowHeight$
* $x = (i \pmod 2 == 0) ? width \times 0.875 : width \times 0.125$
* Cards are offset to the left (for even nodes) or right (for odd nodes) to align with the visual sweep.

---

## 6. Building Executable Files for Different OS Targets

Tauri compiles native binaries. Since cross-compiling Rust/C++ UI dependencies (like WebKit) can be complex, the standard practice is to run builds on the target operating system itself, or use automated GitHub Actions pipelines.

### Prerequisite: Set Unique Identifier
Before running production builds, ensure you configure a unique bundle identifier in `src-tauri/tauri.conf.json`:
```json
{
  "identifier": "com.lifemirror.desktop"
}
```

### Target 1: Linux (`.deb` / `AppImage`)
* **Host Platform:** Linux (Ubuntu/Debian recommended)
* **Required Packages:**
  ```bash
  sudo apt update
  sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```
* **Build Command:**
  ```bash
  npm run tauri build
  ```
  This generates the binary, the `.deb` package, and a standalone `.AppImage` inside `src-tauri/target/release/bundle/`.

### Target 2: Windows (`.msi` / `.exe`)
* **Host Platform:** Windows 10/11
* **Required Software:**
  - [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (select "Desktop development with C++" workload).
  - [WiX Toolset v3](https://wixtoolset.org/releases/v3.11.2/stable/) (required to generate MSI installers).
* **Build Command:**
  ```bash
  npm run tauri build
  ```
  This generates a `.msi` installer and a standalone `.exe` inside `src-tauri/target/release/bundle/`.

### Target 3: macOS (`.dmg` / `.app`)
* **Host Platform:** macOS
* **Required Software:**
  - Xcode Command Line Tools: `xcode-select --install`
* **Build Commands:**
  - **Universal Build (Intel + Apple Silicon):**
    ```bash
    npm run tauri build -- --target universal-apple-darwin
    ```
  - **Native Platform Build:**
    ```bash
    npm run tauri build
    ```
  This generates a mounting disk image (`.dmg`) and a standalone application bundle (`.app`) inside `src-tauri/target/release/bundle/`.

---

## 🌐 Automated CI/CD Builds (GitHub Actions)

To compile for all three platforms in parallel without setting up physical environments, use the official **Tauri Actions** runner. Add the following action workflow file in `.github/workflows/build.yml`:

```yaml
name: Release LifeMirror
on:
  push:
    tags:
      - 'v*'

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target universal-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: install Linux dependencies (Ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: install frontend packages
        run: npm install

      - name: build tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'LifeMirror v__VERSION__'
          releaseBody: 'Privacy-first reflection timeline.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}

---

## 🤖 7. Multi-Agent Orchestration & Skills Architecture

LifeMirror Desktop features a parallel multi-agent development and validation pipeline built on the **Google Antigravity SDK**. 

### 1. Agent Topology
Execution is divided among five specialized AI subagents coordinated concurrently via [scripts/orchestrate_agents.py](file:///var/www/pieapps/lifemirror-desktop/scripts/orchestrate_agents.py):
* **Rust Tauri Core Agent:** Focuses on native window hook loops (`tracker.rs`) and native messaging bridges (`native_msg.rs`).
* **Frontend Web UI Agent:** Implements React UI, SVG serpentine geometry calculus, and timeline pages.
* **Local AI & Data Agent:** Owns SQLite schema layouts, migrations, and Ollama reflection completion prompts.
* **QA & Security Agent:** Inspects database skip behaviors during Incognito Mode and runs offline audits.
* **Project Documenter Agent:** Compiles Developer and User documentation.

### 2. Google Antigravity SDK Integration
Specialized instructions are loaded into each subagent's execution state via local skills in the [skills/](file:///var/www/pieapps/lifemirror-desktop/skills) directory:
```python
# scripts/orchestrate_agents.py
config = LocalAgentConfig(
    model="gemini-3.5-flash",
    skills_paths=["./skills/rust_tauri_core"],
    system_instructions="You are the specialist Rust Tauri Core Agent..."
)
```
Each skill file (`SKILL.md`) specifies capabilities, dependencies, and operational safety rules matching the agent's target area.

### 3. Redundancy & Build Lock Mitigation
To prevent agents running concurrently from triggering duplicate compilations (which causes resource exhaustion and target write locks on build artifacts), the pipeline enforces a **Delegated Build Architecture**:
* **Baseline compilation:** Only the Orchestrator/PM agent runs the full baseline test before launch. Subagents skip baseline checks.
* **Specialist verification:**
  * The Frontend Web UI agent is *only* allowed to execute `npm run build`.
  * The Rust Tauri Core agent is *only* allowed to execute `cargo check` and `cargo test`.
  * Other subagents (Data, QA, Documenter) skip build executions.
* **Integration compilation:** The Orchestrator runs the final combined validation loop after all specialist tasks finish.
```

