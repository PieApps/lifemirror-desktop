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
* `icon_url`: `TEXT` (Nullable, stores website favicon URLs)

### Table 2: `settings`
Persistent configuration store shared across processes (Tauri GUI and CLI Native Messaging Hosts).
* `key`: `TEXT PRIMARY KEY`
* `value`: `TEXT NOT NULL`
* Seeds: `incognito` (defaults to `"false"`), `tracking_active` (defaults to `"true"`), `active_tab_url`, `active_tab_title`, and `active_tab_favicon`.

### Table 3: `chat_history`
Stores the multi-turn persistent chat histories keyed by date for normal tracking sessions.
* `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
* `date`: `TEXT NOT NULL` (maps conversation turns to specific days, e.g. `"2026-06-15"`)
* `role`: `TEXT NOT NULL` (`"user"` or `"assistant"`)
* `content`: `TEXT NOT NULL` (the text content of the message)
* `timestamp`: `TEXT NOT NULL` (ISO 8601 string)

### Table 4: `browser_tab_events`
Stores individual tab switches sent via the browser companion extension separately from active OS-level window session logs.
* `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
* `url`: `TEXT NOT NULL`
* `title`: `TEXT NOT NULL`
* `favicon_url`: `TEXT` (Nullable website favicon URL)
* `domain`: `TEXT` (Nullable website domain)
* `timestamp`: `TEXT NOT NULL` (ISO 8601 string, UTC format)
* `browser_name`: `TEXT` (Nullable name of the browser, e.g. `"Chrome"`)

### Resilient SQLCipher Initialization & Fail-Soft Recovery
On startup, `DbState::new` opens the database and runs a verification query (`SELECT count(*) FROM sqlite_master;`) immediately after applying `PRAGMA key`. If the query fails (due to decryption key changes, file corruption, or database format issues):
1. The connection is cleanly dropped.
2. The corrupt database file is renamed and backed up to `<name>.db.bak`.
3. A fresh, clean database is initialized with the secure credentials, avoiding runtime panic crashes on application boot.

Additionally, a database-level write guardrail is implemented inside `insert_activity_log` to reject insertions immediately if `tracking_active` is `"false"`.

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
    "favIconUrl": "https://github.com/favicon.ico",
    "timestamp": 1718330000
  }
  ```
* **Active Tab Caching:** The native messaging host updates the `settings` table keys (`active_tab_url`, `active_tab_title`, and `active_tab_favicon`) on every tab switch event, which are then read by the background OS focus poller to map active tab URLs to the OS-level window focus state.
* **FIFO Queue & DB Logging:** To handle high-frequency stdin events safely without blocking input readers, the host uses a Rust `mpsc::channel` queue. The stdin reader thread pushes incoming `TabPayload` events onto this queue, and a dedicated background consumer thread dequeues them, writes them to the `browser_tab_events` table via `insert_browser_tab_event`, and caches the active tab in settings. On process termination, the host drops the sender, flushes all remaining events, and joins the consumer thread to guarantee no logged data is lost.

---

## 4. Active Window Focus Poller & State-Sync (`tracker.rs`, `lib.rs`)

### Atomic State Synchronization
The background window poller thread must support clean cancellation. Rather than creating orphan "zombie" threads when tracking is disabled from the UI config panel:
- We pass a thread-safe atomic cancellation flag (`Arc<std::sync::atomic::AtomicBool>`) to the loop.
- Tauri commands `toggle_tracking` and `is_tracking_active` coordinate frontend clicks with this atomic flag.
- The tracking loop polls the atomic flag every 1 second. If disabled, it flushes the active parent session, clears memory buffers, and pauses (sleeps).

### Browser-Window URL Extraction & Domain-Level Aggregation
Under Linux compositor polling (`hyprctl activewindow`, `swaymsg get_tree`, or `xdotool`), the OS only exposes window titles (e.g. `"GitHub - Google Chrome"`). To enrich this data:
1. The tracker identifies if the foreground app is a browser (via `is_browser_app`).
2. If active, it reads `active_tab_title`, `active_tab_url`, and `active_tab_favicon` settings from the SQLite settings table.
3. If the compositor window title contains the active tab title, the activity log is populated with `source: "Browser"`, `url: Some(url)`, and `icon_url: Some(favicon)`.
4. Browser tab focus matches are resolved at the **domain name level** using the `extract_domain` utility. It strips protocols (`http://`, `https://`) and prefixes (`www.`) but preserves subdomains (e.g., matching `youtube.com/watch?v=A` and `youtube.com/watch?v=B` as the same continuous `youtube.com` focus node).

### Micro-Task Aggregation & Focus Transition Logic
To avoid timeline fragmentation while accurately tracking user attention:
- **Brief Diversions**: Switching to a temporary focus (e.g., Slack) for less than 120 seconds and then returning back to the parent focus (e.g., VS Code) folds the temporary duration into the parent session.
- **Diversion Logging**: If the user switches to a third distinct task (e.g., Slack -> Spotify -> GitHub) without returning to the parent, the tracker immediately commits the matured parent session to the database, promotes the previous temporary diversion to the active parent, and initiates a new temporary focus.

### Real-Time UI Active Focus Tracking
To display the current active session on the timeline in real time without writing to the database every second:
1. A thread-safe shared state `active_activity: Arc<std::sync::Mutex<Option<ActivityLog>>>` is managed by the Tauri host.
2. The background tracking thread updates this state every second with the current active parent session.
3. If **Incognito Mode** is activated, this shared state is immediately cleared to `None` to prevent memory leaks of sensitive browsing titles or URLs.
4. The Tauri command `get_current_activity` exposes this state to the React frontend, which prepends it to the timeline and increments the duration smoothly on the client side using local timestamp offsets.

### Persistent Chat Tauri Commands
To interface with the persistent SQLite chat history, three Tauri command endpoints are registered:
- `get_chat_history(date: String)`: Retrieves a chronological array of messages for the selected date.
- `add_chat_message(date: String, role: String, content: String)`: Persists a new message turn into the database.
- `clear_chat_history(date: String)`: Deletes all chat dialogue associated with the selected date.

### Dynamic Log Duration Threshold Settings
The threshold for committing activities to SQLite is dynamically read from the database using the `"min_log_duration"` setting:
- **Default value**: 60 seconds (1 minute).
- **Configurability**: Configurable from the React settings panel (via a slider and clamped number input between 60 and 300 seconds).
- **Execution**: The background tracker thread query-checks this setting on every iteration and discards any completed window session whose duration is less than the specified threshold.

### System Tray & Bidirectional State Synchronization
To allow seamless background monitoring and control, the application registers a system status tray menu:
1. **Instantiation**: `setup_system_tray` in `lib.rs` constructs the tray icon using the `TrayIconBuilder::with_id("main-tray")` API.
2. **Interaction**: A single left-click on the tray icon immediately shows and focuses the main window. Right-clicking displays a context menu containing:
   - **Open LifeMirror**: Shows the main window.
   - **Incognito Mode**: Programmatic checkbox toggle.
   - **Tracking Active**: Programmatic checkbox toggle.
   - **Quit**: Fully exits the application process.
3. **State Management**: The references to the tray's `CheckMenuItem` checkbox toggles are managed inside a native Tauri state struct (`TrayMenuState`). When the user toggles Incognito or Tracking states from the React frontend, the Tauri commands update the tray checkbox check state and swap the tray icon (Normal, Gray/Paused, or Amber/Incognito) dynamically in Rust.
4. **Events Sync**: When modified directly from the system tray context menu, the backend updates settings in SQLite, changes the tray icon, and emits global events (`"incognito-changed"` and `"tracking-changed"`) to sync the React UI in real time.

### Background Hide & Close Behavior
Standard window close requests are intercepted:
- **Hook**: Intercepted in `lib.rs` inside the `on_window_event` hook for `WindowEvent::CloseRequested`.
- **Logic**: The handler always prevents window destruction (`api.prevent_close()`) and hides the window (`window.hide()`) to keep the application running in the background.
- **Background Notification**: On the very first hide trigger, the backend registers the hide action and triggers a native Linux `notify-send` system notification informing the user that the process continues tracking in the background and that they can quit from the tray icon.

### Launch on Startup (Autostart)
Boot integration is managed natively:
- **Tauri Plugin**: Registered via `tauri-plugin-autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--hidden"]))`.
- **Boot Visibility**: Passes the `--hidden` flag to the application on OS boot startup.
- **Initialization**: The Tauri setup hook checks `std::env::args()`. If `"--hidden"` is present, it skips showing the webview window, leaving only the system tray icon active.

---

## 5. UI Layout, Custom Themes & Brand Icons (`SCurveTimeline.tsx`, `App.tsx`)

### Dynamic Frosted-Glass Themes
The application supports dynamic switching between Dark and Light mode themes via CSS custom variables defined in `src/index.css`.
- **Dark Theme (`[data-theme="dark"]`)**: Deep-space background (`#0d0d11`), dark frosted glass card overlays, and high-visibility neon-purple drop shadows.
- **Light Theme (`[data-theme="light"]`)**: Frosted-white glass cards with high backdrop blur (`blur(12px)`), soft shadows, and clean slate-gray borders.

The frontend uses `localStorage` to persist user theme preferences and sets the root `data-theme` attribute on boot.

### Brand Icons
To show app-specific logos on timeline curves and activity cards, `AppIcon` maps active processes and websites dynamically:
1. **Websites**: If the source is `"Browser"`, it renders the dynamic site favicon (using `icon_url` or falling back to the Google Favicons API).
2. **Desktop Apps**: Matches keywords in `app_name` (e.g., `"code"`, `"terminal"`, `"spotify"`, `"slack"`, `"figma"`, `"zoom"`) to load beautiful brand-colored vector SVG icons.
3. **Fallback**: Standard generic Monitor/Globe icons.

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
```

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

### 2. Google Antigravity SDK Integration & Skills Behavior
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

#### Skill Invocation Behavior
* **Automatic Detection:** The Antigravity AI assistant automatically scans, selects, and activates relevant skills based on the active file types, user request, or task context. The developer does **not** need to manually select or enable skills during a session.
* **Manual Override:** Developers can explicitly prompt the assistant to trigger a specific skill or adhere to one of the custom skills by name (e.g., "Use the `qa_security` skill to audit this file").

#### Skill Matrix (When & How to Use)
The following table outlines the purpose of each skill in the `skills/` directory and when it is utilized:

| Skill Directory | Skill Name | Primary Use Case & Triggers | Key Instructions |
| :--- | :--- | :--- | :--- |
| [rust_tauri_core](file:///var/www/pieapps/lifemirror-desktop/skills/rust_tauri_core) | `rust_tauri_core` | Modifying Tauri backend code, active window focus tracking (`tracker.rs`), or Native Messaging communication (`native_msg.rs`). | Read native-endian browser frames, check session type (Wayland/X11), enforce thread-safe Incognito checks. |
| [frontend_ui_web](file:///var/www/pieapps/lifemirror-desktop/skills/frontend_ui_web) | `frontend_ui_web` | Working on React dashboard UI, SVG S-curve coordinate maths, styling/glassmorphism, or browser-side Ollama hooks. | Winding S-curve geometry formulas, violet/dark aesthetics, call local Ollama completion endpoints. |
| [local_ai_data](file:///var/www/pieapps/lifemirror-desktop/skills/local_ai_data) | `local_ai_data` | Modifying database schemas (`db.rs`), SQLCipher page-level encryption, database migrations, or Ollama prompt templates. | SQLCipher encryption setup, database key initialization (`PRAGMA key`), two-sentence reflection summaries. |
| [qa_security](file:///var/www/pieapps/lifemirror-desktop/skills/qa_security) | `qa_security` | Auditing local privacy behavior, checking for potential port leaks, or validating data isolation. | Ensure zero remote telemetry, confirm no local listening sockets (exclusive stdio messaging), assert zero database writes in incognito. |
| [project_documenter](file:///var/www/pieapps/lifemirror-desktop/skills/project_documenter) | `project_documenter` | Drafting, styling, or updating markdown developer documentation or user setup instructions. | Maintain architectural accuracy in `DEVELOPER.md`, update setup instructions in `USER.md`, document workflows. |

### 3. Redundancy & Build Lock Mitigation
To prevent agents running concurrently from triggering duplicate compilations (which causes resource exhaustion and target write locks on build artifacts), the pipeline enforces a **Delegated Build Architecture**:
* **Baseline compilation:** Only the Orchestrator/PM agent runs the full baseline test before launch. Subagents skip baseline checks.
* **Specialist verification:**
  * The Frontend Web UI agent is *only* allowed to execute `npm run build`.
  * The Rust Tauri Core agent is *only* allowed to execute `cargo check` and `cargo test`.
  * Other subagents (Data, QA, Documenter) skip build executions.
* **Integration compilation:** The Orchestrator runs the final combined validation loop after all specialist tasks finish.

