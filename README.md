# 📋 LifeMirror Desktop

LifeMirror Desktop is a privacy-first, local-focused productivity reflection utility. It captures continuous operating system activity logs and browser tab focus histories natively, records them securely in a local encrypted SQLCipher database, visualizes your day as a beautiful serpentine "S-Curve" timeline infographic, and automatically synthesizes your work into a 100% offline, Obsidian-compatible **Knowledge Vault & Autonomous LLM Wiki**.

Additionally, LifeMirror interfaces with an intelligent reflection engine to compile daily mindfulness reflection cards and multi-tier periodic reviews. By default, it operates 100% offline using a locally running AI model (Ollama) so no analytical data ever leaves your computer, while also offering an optional, strictly-disclosed Bring-Your-Own-Key (BYOK) cloud mode for instant setup on lighter hardware.

---

## 📦 Installing Pre-Built Binaries

Pre-compiled desktop binaries are available under GitHub [Releases](../../releases). Because LifeMirror Desktop is an independent open-source project distributed without paid commercial signing certificates, your operating system will display a standard first-run prompt:

* **Windows 10 / 11**: Click **More info** → **Run anyway** on the Microsoft Defender SmartScreen dialog.
* **macOS (Sequoia 15+)**: Open the app once to trigger the warning, then go to **System Settings → Privacy & Security**, scroll down to the **Security** section, and click **Open Anyway**.
  * *Terminal command*:
    ```bash
    xattr -dr com.apple.quarantine "/Applications/LifeMirror Desktop.app"
    ```
* **Linux (.deb / AppImage)**:
  * Debian / Ubuntu: `sudo dpkg -i lifemirror-desktop_*.deb`
  * AppImage: `chmod +x lifemirror-desktop_*.AppImage && ./lifemirror-desktop_*.AppImage`
  * *Note for Ubuntu 22.04+*: Run `sudo apt install libfuse2` if running the standalone AppImage.

---

## 🚀 Building & Running from Source

### 1. Install Prerequisites

| Tool | Version | Link |
|------|---------|------|
| **Node.js** | ≥ 18 | https://nodejs.org |
| **Rust** | stable | https://rustup.rs |
| **WebView2** *(Windows only)* | latest | Pre-installed on Windows 11; [download for Windows 10](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |

> [!NOTE]
> **Windows** users also need the [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/). During installation, select the **"Desktop development with C++"** workload.

### 2. Install Node dependencies

```bash
npm install
```

### 3. Run the Development Server

To launch the development version isolated from your installed production application:

```bash
npm run tauri:dev
```

This compiles the Vite frontend and Rust backend in dev mode with an isolated data directory (`~/.local/share/lifemirror-dev`), partitioned OS keyring service (`com.lifemirror.desktop.dev`), and unique app identifier, allowing production and development to run simultaneously without interference.

You can also run standard dev mode:

```bash
npm run tauri dev
```

#### Developer Data Scripts
- **Reset Dev Data**: `npm run dev:reset-data` (safely wipes dev database and webview cache)
- **Import Production Data**: `npm run dev:merge-data` (safely snapshots your production database and Knowledge Vault notes into dev for real-world testing)

---

## 🪟 Windows — Step-by-Step Installation

> [!IMPORTANT]
> Follow these steps in order on a Windows machine. All commands are run in **Command Prompt** or **PowerShell** (no admin required unless noted).

#### Step 1 — Install Rust

Open PowerShell and run:
```powershell
winget install Rustlang.Rust.MSVC
```
Or download the installer from https://rustup.rs and follow the prompts.  
When asked, choose **option 1** (default installation with MSVC toolchain).

#### Step 2 — Install Visual Studio C++ Build Tools

Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

During setup, check **"Desktop development with C++"** and click Install.

#### Step 3 — Install Node.js

```powershell
winget install OpenJS.NodeJS.LTS
```
Or download from https://nodejs.org (choose the LTS version).

#### Step 4 — Install WebView2 (Windows 10 only)

Windows 11 ships with WebView2 pre-installed. On Windows 10:
```powershell
winget install Microsoft.EdgeWebView2Runtime
```

#### Step 5 — Clone the project and install dependencies

```powershell
git clone https://github.com/your-org/lifemirror-desktop.git
cd lifemirror-desktop
npm install
```

#### Step 6 — Run the Development Server

```powershell
npm run tauri:dev
```

This compiles the Vite frontend and Rust backend in development mode with an isolated dev environment.

---

## ⚙️ Configuration Guides

### Browser Tab Tracking & Reflection (Chrome Extension)

The LifeMirror Chrome extension operates in **dual modes**:
* **Standalone Mode**: Runs directly inside Chrome with zero setup. Captures dwell time, hourly rhythms, top domains, meta descriptions, and smart category tags (`💻 Dev`, `📚 Docs`, `🎬 Media`) in a persistent **Chrome Side Panel** with 1-click easy tag revision.
* **Desktop Native Sync**: When LifeMirror Desktop is running, tab events stream over a sandboxed stdin/stdout **Native Messaging** channel directly into your encrypted SQLCipher database, displaying full page descriptions in the S-Curve sidebar and enriching local Ollama reflection prompts.

| Platform | Native messaging host manifest location (registered automatically) |
|----------|--------------------------------------------------------------------|
| **Windows** | `%LOCALAPPDATA%\LifeMirror\NativeMessagingHosts\com.lifemirror.desktop.json` |
| **macOS** | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` |
| **Linux** | `~/.config/google-chrome/NativeMessagingHosts/` |

On Windows, the required registry key is also configured automatically:
```
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.lifemirror.desktop
```

### Privacy, Domain Exclusion & URL Sanitization

LifeMirror is built on a local-first, zero-cloud architecture with comprehensive privacy defenses:

* **Domain Exclusion / Blacklist**: Permanently exclude sensitive websites (banking, healthcare, webmail, private intranets). Excluded domains are **never recorded**—dwell time, page titles, URLs, and summaries are blocked before storage and transmission.
* **Granular Purge Options**: When adding a domain to the exclusion list, choose between:
  1. *Also delete existing history from LifeMirror (recommended)*: Scrubs past records from `sub_session_events`, related `activity_logs` window titles, and regenerable daily summaries.
  2. *Only stop tracking from now on*: Preserves historical timeline data while blocking all future tracking.
* **Physical Erasure**: Purging activates SQLite's `PRAGMA secure_delete = ON` and executes a WAL truncation checkpoint (`wal_checkpoint(TRUNCATE)`), physically overwriting freed database pages on disk.
* **Journal Reflections Safe**: User notes and reflections attached to purged timeline nodes are never lost—they are preserved as unattached entries and remain accessible under Settings → View Unattached Notes.
* **URL Parameter Stripping**: Query strings (`?token=...`) and hash fragments (`#...`) are stripped by default across the extension and desktop backend to prevent leaking reset tokens, session IDs, or private arguments.
* **Search Engine Query Masking**: Window and tab titles for major search engines (Google, Bing, DuckDuckGo, Yahoo, Baidu, Yandex, Ecosia, Brave, Qwant, Startpage) are automatically masked (e.g. `"Google Search"` instead of `"symptoms of X - Google Search"`).
* **Scope Clarification**: LifeMirror manages its own local records and does not alter Chrome's internal history. Third-party authentication portals (OAuth/SAML) and payment gateways redirect through independent domains and should be excluded individually.

### Pluggable AI: Local-First by Default with Opt-In Cloud (BYOK)

LifeMirror features an abstracted `InferenceProvider` architecture that puts privacy and user choice first. You decide how your reflections are generated:

* **Private: Runs on your computer (Local Ollama — Default & Recommended)**:
  * 100% offline, zero data sent to external servers, and free forever.
  * In-app native model download (`/api/pull`) lets you download models such as `llama3.2` directly from the UI without terminal commands.
  * Works best on computers with 16GB+ RAM (~2.0 GB–4.0 GB disk space).
* **Faster: Uses an online service (Cloud AI — Bring Your Own Key)**:
  * 0 MB download and instant setup on any computer or lightweight laptop.
  * Native presets for **Groq** (free tier with `llama-3.3-70b-versatile`), **OpenAI** (`gpt-4o-mini`), and **OpenRouter**, plus custom OpenAI-compatible endpoints.
  * **Strict Data Boundaries**: Before any cloud key is saved, you review a **Privacy & Data Impact Review** featuring an interactive **live payload preview** of the exact data being sent.
  * **Never Sent**: Incognito sessions and excluded domains are strictly filtered out before transmission. Keystrokes, passwords, clipboard, screen captures, and local SQLite databases are never transmitted.
  * **Cost Protection**: Background idle reflection summarizers are automatically suspended in Cloud mode to prevent unintended billable calls while AFK.
  * **One-Click Revocation**: Revoke access and purge the encrypted API key at any time from Settings → AI Settings.
* **Track without AI (Skip for now)**:
  * Run LifeMirror purely as an offline activity tracker and focus timer with zero AI configuration required.

* **On-Demand Intelligence Architecture**: Designed for quiet, fanless operation and all-day battery life. Passive window and tab tracking runs continuously from boot at <0.01% CPU in pure Rust, while heavy neural network passes (summaries, entity tags, vector embeddings) remain suspended until explicitly requested (*Reflect with AI*, querying *Chat*, or requesting a *Catch-up* brief).
* **Fail-Fast Circuit Breaker**: If local Ollama is offline or unreachable, LifeMirror detects it in sub-second time (600ms probe) and enters complete dormancy—no socket timeout hangs, zero background retry storms, and no CPU throttling.

#### Getting Started with AI:
1. Open LifeMirror Desktop. AI setup is completely optional and non-intrusive—you can explore your timeline immediately.
2. When ready, click **"Set Up AI for Reflections"** on the dashboard or open **Settings** (top-right cog) → **AI Settings**.
3. Select your preferred mode:
   - **On-Device (Local)**: Select your local model (e.g. `llama3.2`) and download it with 1 click.
   - **Online Service (Cloud)**: Enter your API key (Groq, OpenAI, or OpenRouter), inspect the live data payload preview, and confirm.
   - **Skip**: Continue tracking offline without AI.

For cross-OS local setup and model management, see the [Ollama Configuration Guide](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md) and [AI Integration Architecture](file:///var/www/pieapps/lifemirror-desktop/docs/AI_INTEGRATION.md).

---

## 📚 Knowledge Vault & Autonomous LLM Wiki

Inspired by Andrej Karpathy's LLM Wiki philosophy and Steve Krug's *Don't Make Me Think* design principles, LifeMirror transforms ephemeral screen time into a structured, persistent knowledge base stored locally in plain Markdown:

* **100% Local & Obsidian-Compatible**: Vault stored in `~/Documents/LifeMirror Vault/` with standard YAML frontmatter and bidirectional `[[wikilinks]]`. Open, search, and edit your notes directly inside LifeMirror, Obsidian, Logseq, or VS Code.
* **3-Tier Periodic Notes Hierarchy**:
  * 🗓️ **Monthly Reviews** (`periodic/monthly_YYYY-MM.md`): Executive synthesis summarizing monthly momentum, linking strictly to Weekly reviews with zero cognitive noise.
  * 📅 **Weekly Reviews** (`periodic/weekly_YYYY-Www.md`): Summarizes productivity, top projects, and links strictly to the 7 Daily reviews.
  * ☀️ **Daily Reviews** (`periodic/daily_YYYY-MM-DD.md`): Summarizes daily focus and links to curated key work sessions (>2m) with human-readable timestamps and titles.
* **Executive KPI Dashboards**: Every periodic note renders a formatted executive KPI strip (Active Time, Top Project, Review Horizon, Coverage) and interactive breadcrumb navigation (`> [[index|🏠 Hub]] > [[weekly|Week 47]] > **Day Review**`).
* **Deep Work Session Notes**: Click any activity block on your timeline to open the Session Drawer, compile markdown notes, run 1-click AI enrichment, edit inline, or move to `.trash/`.
* **Flexible Sidepanel Width**: Fluid draggable splitter bars (`cursor-col-resize`) across the Knowledge Vault explorer, main AI/Settings sidepanel, and session activity drawer with persisted width settings.

---

## 📦 Packaging & Distribution

LifeMirror uses Tauri's native bundler to create installers for each platform.

**Build for your current OS:**
```bash
npm run tauri build
```

Output goes to `src-tauri/target/release/bundle/`.

### Platform Outputs

#### 🪟 Windows
| Format | Path |
|--------|------|
| NSIS installer (`.exe`) | `src-tauri\target\release\bundle\nsis\lifemirror-desktop_x.x.x_x64-setup.exe` |
| MSI package | `src-tauri\target\release\bundle\msi\lifemirror-desktop_x.x.x_x64_en-US.msi` |

#### 🐧 Linux (Debian/Ubuntu)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```
Output: `src-tauri/target/release/bundle/deb/lifemirror-desktop_x.x.x_amd64.deb`

#### 🍎 macOS
```bash
xcode-select --install
```
Output: `src-tauri/target/release/bundle/dmg/lifemirror-desktop_x.x.x_x64.dmg`

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [User Guide](file:///var/www/pieapps/lifemirror-desktop/docs/USER.md) | Initial installation, Chrome extension setup, Knowledge Vault, and settings |
| [Core Use Cases](file:///var/www/pieapps/lifemirror-desktop/docs/use_cases.md) | Autonomous semantic memory graph, Knowledge Vault, distraction defense, and workflow automation |
| [AI Integration](file:///var/www/pieapps/lifemirror-desktop/docs/AI_INTEGRATION.md) | Inference engine architecture, local & cloud provider specifications, and privacy boundaries |
| [Ollama Setup](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md) | Model management and environment variable configuration |
| [Database Schema](file:///var/www/pieapps/lifemirror-desktop/docs/database_schema.md) | SQLCipher encrypted tables, indexes, memory graph, and settings key-value definitions |
| [Developer Docs](file:///var/www/pieapps/lifemirror-desktop/docs/DEVELOPER.md) | IPC commands, Knowledge Vault architecture, Wayland focus hooks, S-curve geometry, packaging |
| [Development Environment](file:///var/www/pieapps/lifemirror-desktop/docs/development-environment.md) | Concurrent dev/prod isolation, database paths, and data management scripts |
| [Workflow Guide](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md) | Step-by-step instructions for safely implementing future changes |
