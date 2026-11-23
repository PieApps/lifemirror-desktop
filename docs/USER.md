# 🖥️ LifeMirror Desktop: User Guide

Welcome to LifeMirror Desktop! This privacy-first utility turns your raw daily activity logs into a beautiful serpentine scrollable timeline, giving you mindful daily summaries driven by a locally running AI model.

---

## 1. Prerequisites & Installation

### Packaged Desktop Binaries (First-Time Launch Guide)

Because LifeMirror Desktop is an independent open-source utility distributed without commercial signing certificates, your operating system will display a standard first-run warning when launching downloaded binaries:

* **Windows 10 / 11 (SmartScreen)**:
  When the blue *"Windows protected your PC"* message appears:
  1. Click **More info**.
  2. Click **Run anyway**.
* **macOS (Sequoia 15+)**:
  1. Double-click `LifeMirror Desktop.app` once (Gatekeeper prompts standard security warning).
  2. Open **System Settings → Privacy & Security**.
  3. Scroll down to the **Security** section and click **Open Anyway**.
  4. *Terminal alternative*:
     ```bash
     xattr -dr com.apple.quarantine "/Applications/LifeMirror Desktop.app"
     ```
* **Linux (.deb / AppImage)**:
  * **Debian / Ubuntu**: `sudo dpkg -i lifemirror-desktop_*.deb`
  * **AppImage**: `chmod +x lifemirror-desktop_*.AppImage && ./lifemirror-desktop_*.AppImage`
  * *Note for Ubuntu 22.04+*: Install `libfuse2` if running AppImages: `sudo apt install libfuse2`.

---

### Building & Running from Source

To run LifeMirror Desktop locally from source, ensure you have Rust (Tauri 2.0 compiler core) and Node.js installed:

```bash
# Clone the repository and install Node dependencies
npm install
```

### Run GUI Desktop Dev Server
```bash
npm run tauri dev
```

---

## 2. Linking the Chrome Companion Extension

The LifeMirror Chrome extension operates in **dual modes**:
* **Standalone In-Browser Mode (Zero Setup)**: Operates 100% inside Google Chrome (and Chromium, Brave, Edge, Arc, Opera, Vivaldi) without requiring the desktop application. Includes a dedicated **Chrome Side Panel** featuring a 24-hour focus rhythm heat-strip, top domain breakdown with animated progress bars, automated page descriptions (`<meta name="description">`), smart auto-tags (`💻 Dev`, `📚 Docs`, `🎬 Media`), and a 1-click easy revise popover.
* **Desktop Sync Mode**: Automatically syncs active web browsing sessions, page descriptions, and category tags directly into the local LifeMirror Desktop application via Chrome's secure **Native Messaging API** (stdio pipes).

### Using the Chrome Side Panel (Standalone or Synced)
1. Click the LifeMirror icon in the Chrome toolbar.
2. Click **"Open Side Panel Reflection"** to open the side panel alongside your active browsing.
3. Review your **Hourly Focus Rhythm**, filter sessions by intent, and click any tag chip to revise its category in 1 click (no typing required).
4. Inactivity is detected automatically: if you step away from your keyboard for >60 seconds, time tracking pauses automatically (`chrome.idle`).

### Linking Extension to LifeMirror Desktop (Automatic Native Sync)
The desktop application automatically registers the Native Messaging host manifest with your browser (Google Chrome, Chromium, Brave, Microsoft Edge, Vivaldi, Opera) and sets up the required Windows registry keys upon launch.

To sync browsing sessions with desktop:
1. Install **LifeMirror Companion** from the [Chrome Web Store](https://chromewebstore.google.com/detail/lifemirror-desktop-compan/pblffjiaheggbamkjaojabdaemkflhmm).
2. Ensure LifeMirror Desktop is running.
3. Active tab updates, descriptions, and category tags will now stream automatically into your local encrypted SQLCipher timeline.

For local unpacked extension development:
1. Open `chrome://extensions/` and enable **Developer Mode**.
2. Click **Load unpacked** and select `companion-extension/`.
3. Development builds of LifeMirror Desktop (`npm run tauri:dev`) will connect without requiring manual manifest copying.

---

## 3. Configuring AI (Local-First or Opt-In Cloud)

LifeMirror is **private by default and local-first**. You have complete control over whether and how artificial intelligence processes your activity logs.

### Zero-Interruption Launch
When you open LifeMirror for the first time, you are never blocked by a required setup wizard. You land directly on your timeline dashboard. When you are ready to configure AI reflections, you can click **"Set Up AI for Reflections"** on the dashboard or open **Settings** (gear icon) → **AI Settings**.

### Guided 3-Option Setup
The setup dialog offers three clear choices tailored to your preferences and hardware:

1. **Private: Runs on your computer (Local AI — Default & Recommended)**
   * **100% Offline:** All prompts and embeddings are processed locally. No analytical data or telemetry ever leaves your computer.
   * **Hardware Requirements:** Requires ~2.0 GB–4.0 GB of disk space per model. Best suited for computers with 16GB+ RAM.
   * **In-App Installation:** If you have [Ollama](https://ollama.com) installed, LifeMirror detects it automatically on `http://localhost:11434`. You can download models (such as `llama3.2`) directly from the UI with a single click—no command line needed!
2. **Faster: Uses an online service (Cloud AI — Bring Your Own Key)**
   * **Instant & Lightweight:** 0 MB download size; runs immediately with high performance even on older or resource-constrained laptops.
   * **Supported Presets:** Groq (fast free tier with `llama-3.3-70b-versatile`), OpenAI (`gpt-4o-mini`), OpenRouter, or custom OpenAI-compatible endpoints.
   * **Gated by Privacy Review:** Before saving your key, you must review and confirm the **Privacy & Data Impact Review**.
3. **Track without AI (Skip for now)**
   * Run LifeMirror purely as an offline activity tracker and focus timer. You can configure AI at any time later.

---

### Privacy Boundaries & Data Impact Review (Cloud Mode)
If you opt into Cloud AI, LifeMirror enforces strict boundaries before transmitting any prompts:
* **What Leaves Your Device:** Open application names (e.g. `VS Code`, `Chrome`), window and session titles, duration, and notes attached to reflections.
* **What NEVER Leaves Your Device:**
  * **Incognito Sessions:** Automatically stripped before assembling prompts.
  * **Excluded Domains:** Any websites on your privacy blacklist are permanently blocked from prompt payloads.
  * **Sensory & OS Data:** Keystrokes, passwords, clipboard contents, screen captures, and your local SQLite database are never captured or transmitted.
* **Live Payload Preview:** The setup modal displays the exact JSON payload from your last 3 actual sessions so you can inspect what would leave your machine before confirming.
* **Cost Protection:** Background idle reflection loops are suspended in Cloud mode to prevent unexpected API bills while you are AFK.
* **1-Click Revocation:** Click **"Delete Key & Revoke Cloud Access"** in Settings → AI Settings at any time to purge your API key from encrypted storage and revert immediately to offline mode.

---

### AI Processing Modes
Under Settings → AI Settings, you can configure:
* **On-Demand Mode (Recommended, Default):** Background neural network passes (idle reflections, automated tagging, vector embeddings) remain suspended. Intelligence runs strictly when you click *Reflect with AI*, query *Chat*, or open a *Catch-up* brief. This keeps your machine cool, fans silent, and battery life maximized.
* **Continuous Background Mode:** Pre-indexes memory nodes in the background every 60 seconds (best suited for plugged-in desktop workstations with dedicated GPUs; automatically dormant on Cloud mode).
* **Fail-Safe Circuit Breaker:** When Ollama is stopped or unreachable, LifeMirror detects it in sub-second time (600ms probe) and enters complete dormancy—no hanging connections, retry storms, or CPU spikes.

### Using Reflections and Chat
In the AI sidebar on the right:
* Click **Reflect with AI** to synthesize your daily activity into a concise mindfulness reflection. Reflection cards display a provenance badge indicating which engine generated them (e.g., `[Local: llama3.2]` or `[Cloud: Groq llama-3.3-70b-versatile]`).
* Select **Chat** to ask natural-language questions about your productivity (*"Where did my time go this morning?"*). All chat queries respect your incognito and domain exclusion filters.

> For advanced Ollama setup and cross-platform installation instructions, see the [Ollama Configuration Guide](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md). Detailed engineering specifications are available in the [AI Integration Guide](file:///var/www/pieapps/lifemirror-desktop/docs/AI_INTEGRATION.md).

---

## 4. Key Application Features

* **S-Curve Timeline & Real-Time Tracking:** Scroll through a winding serpentine infographic mapping your computer usage. Monitored active OS window sessions sit alongside browser tab events. The timeline dynamically displays your currently active task in real time, with the counter ticking up smoothly second-by-second.
* **Interactive Local AI Chat:** Ask custom questions about your productivity and desktop focus directly to your local AI model. The AI receives a token-budgeted daily activity rollup (top apps and recent window switches) to answer questions like *"Where did I spend the most time today?"* with character-by-character real-time streaming.
* **Timeline App Icons & Favicons:** The timeline automatically displays dynamic website favicons (both for past logs and for the real-time active tracker) and custom brand-specific vector icons (VS Code, Discord, Slack, terminal, Spotify, Figma, etc.) for popular desktop applications.
* **Browser Session Grouping & Accordion Inspection:** Consecutive browser events are grouped into a single timeline card showing total session duration, start time, and a tab visited count. Clicking this card expands an interactive list detailing each individual tab visited (including favicon, page title, domain, and calculated duration), with no visual layout shifts on the S-Curve.
* **Reflective Journaling:** Click "Reflect" on any timeline node to open a notes editor. Save your thoughts directly into the local encrypted SQLCipher database.
* **Incognito Mode:** Toggle Incognito Mode to temporarily freeze all active focus tracking and browser tab logging. While active, the in-memory active session cache is wiped immediately, a glassmorphic blur and lock screen overlay are displayed, and AI Chat routing shifts to a volatile, non-saved memory array.
* **Background OS Tracking Control:** Turn background window monitoring on or off from the Local-First configurations panel. Toggling it off terminates active tracking loops, clears active state caching, and prevents database insertions.
* **Theme Selection:** Toggle between a deep neon-glow Dark Mode and a premium frosted-glass Light Mode using the Sun/Moon switcher button in the header. Preferences are automatically persisted across launches.
* **System Tray Control & Close-to-Tray:** The application runs as a background utility. Closing the window with the 'X' button hides it to the system status tray rather than quitting. Single-click the tray icon to restore the window. Right-click the icon to pause or resume tracking, or completely Quit the app.
* **Launch on Startup:** A "Launch on Startup" toggle registers the application with the operating system to automatically start hidden in the system tray when your computer boots up.
* **Minimum Logging Threshold:** Customize the minimum time a window must be in focus (60 to 300 seconds, with a minimum of 1 minute) using a slider or input box to be recorded in the database, avoiding database bloat from quick clicks or window switches.
* **Domain Exclusion & Privacy Blacklist:** Permanently block sensitive websites (banking, healthcare, private intranets, personal communication) from being tracked in LifeMirror Desktop and the Companion Extension:
  * **Adding Exclusions:** Open **Settings** (gear icon) → **Privacy & Excluded Domains**, enter a domain (e.g. `chase.com` or `mychart.com`), choose whether to include subdomains, and click **Exclude Domain**. You can also check one or more one-click category presets (Banking & Finance, Healthcare, Personal Webmail, Local Intranets) or click the `🚫` button directly on any reflection card in the Chrome Extension side panel or popup.
  * **Purge vs. Future-Only:** When adding an exclusion, a confirmation dialog asks:
    1. *Also delete existing history from LifeMirror (recommended)*: Removes matching past `sub_session_events`, clears associated `activity_logs` window titles, and invalidates cached daily rollups.
    2. *Only stop tracking from now on*: Keeps past timeline history intact while blocking all future visits.
  * **Unattached Notes Preservation:** Personal reflections and notes written on purged timeline cards are **never deleted**. They are detached and preserved in the encrypted database. Click **View Unattached Notes** in the Settings panel at any time to inspect them.
  * **Physical Erasure:** Database purges use SQLite's `PRAGMA secure_delete = ON` and execute a WAL truncate checkpoint, physically overwriting freed pages on disk.
  * **URL Sanitization & Search Query Masking:** Full URLs have query strings (`?token=...`) and hash fragments (`#...`) stripped before saving to prevent capturing authentication tokens or session IDs. Search engine tab titles (Google, Bing, DuckDuckGo, Yahoo, etc.) are automatically masked to the engine name (e.g., `"Google Search"`) to protect private search queries.
  * **Boundaries & Scope:** LifeMirror manages its own local records and does not touch Chrome's internal browsing history. External authentication providers (OAuth, SAML) and payment gateways redirect through separate domains and must be excluded individually.
  * **Bidirectional Sync:** Exclusions synchronize automatically between the Chrome extension and desktop app via Native Messaging. If changes occur offline, they reconcile safely on reconnect using Last-Writer-Wins (exclusions win ties) and tombstones.
* **Deep Work Enforcement (Active Interdiction):** Transition from passive tracking to active focus defense. Define blacklisted keywords and regex rules in the Settings to instantly block distracting windows with a glassmorphic overlay. Take it a step further by setting an **Active Intention Goal** (e.g., "Writing a project proposal") on the main dashboard; the app will use your Local AI to asynchronously evaluate new windows on the fly and block anything that pulls you away from your active goal.

---

## 5. Knowledge Vault & Autonomous LLM Wiki

LifeMirror Desktop includes an autonomous **Knowledge Vault & LLM Wiki** inspired by Andrej Karpathy's personal LLM Wiki architecture and Steve Krug's classic usability handbook *Don't Make Me Think*. It bridges the gap between passive computer activity tracking and active personal knowledge management.

### Local-First & Obsidian-Native
All notes are stored directly on your computer's filesystem in standard Markdown with YAML frontmatter:
* **Default Directory:** `~/Documents/LifeMirror Vault/` (on Windows: `C:\Users\<User>\Documents\LifeMirror Vault\`).
* **Open Format:** 100% interoperable with [Obsidian](https://obsidian.md), Logseq, VS Code, iA Writer, or any plain-text tool.
* **Bidirectional Linking:** Uses standard Obsidian `[[wikilinks]]` and aliased links (`[[projects/lifemirror|LifeMirror]]`) throughout.
* **1-Click External Editing:** Click **"Open in Obsidian"** in the top-right header to instantly launch your vault or active note in your default markdown editor.

### Vault Directory Hierarchy
```text
~/Documents/LifeMirror Vault/
├── index.md             # Hub linking all projects, topics, and periodic reviews
├── log.md               # Master chronological activity append log
├── projects/            # Project hubs auto-synced from memory nodes and custom notes
│   ├── lifemirror-desktop.md
│   └── website.md
├── topics/              # Concept and research synthesis pages
│   ├── rust-tauri.md
│   └── sqlcipher-encryption.md
├── sessions/            # Deep-dive work session notes compiled from timeline events
│   ├── 20261116_0930_backend-refactor.md
│   └── 20261116_1430_timeline-geometry.md
├── periodic/            # 3-tier hierarchical periodic reviews
│   ├── daily_2026-11-16.md
│   ├── weekly_2026-W47.md
│   └── monthly_2026-11.md
└── .trash/              # Safe staging folder for archived or deleted notes
```

---

### "Don't Make Me Think" 3-Tier Drill-Down Hierarchy
A common failure of automated journaling is dumping dozens of raw, fragmented session links into macro reviews, resulting in visual clutter and cognitive fatigue. LifeMirror implements a strict, 3-tier progressive disclosure hierarchy:

1. 🗓️ **Monthly Reviews (`periodic/monthly_YYYY-MM.md`)**:
   * Features an **Executive Synthesis** card summarizing month-long momentum, top projects, and active focus hours.
   * Links **exclusively to the Weekly Reviews** contained in that month (`[[periodic/weekly_2026-W47|Week 47 (Nov 16 – Nov 22)]]`) with duration badges.
   * **Zero micro-sessions**: Macro reviews remain high-level, readable, and clutter-free.
2. 📅 **Weekly Reviews (`periodic/weekly_YYYY-Www.md`)**:
   * Summarizes weekly accomplishments and highlights key focus patterns.
   * Links **exclusively to the 7 Daily Reviews** of that week (`[[periodic/daily_2026-11-16|Monday, Nov 16]]`) with active durations and primary projects. Offline or rest days are gently labeled (`*(Offline / Rest)*`).
   * **Zero micro-sessions**: Keeps weekly planning and retrospectives fast and scannable.
3. ☀️ **Daily Reviews (`periodic/daily_YYYY-MM-DD.md`)**:
   * Summarizes the day's focus, top applications, and focus duration.
   * Curates and links only **Major Work Sessions** (>2 minutes) using clean, human-readable labels:
     `[[sessions/20261116_0930_backend-refactor|09:30 AM – Backend Refactor (45m)]]`.
   * Completely eliminates raw filenames and noisy sub-second clicks.

### Executive KPI Dashboards & Interactive Breadcrumbs
Every periodic note opens with a clean executive dashboard strip:
* ⏱️ **Active Duration:** Formatted time (e.g. `5h 24m`).
* 🚀 **Top Project:** Primary project name with icon.
* 📅 **Review Horizon:** `Daily Review`, `Weekly Review`, or `Monthly Review`.
* ✨ **Coverage:** Metric showing active days, weeks, or curated sessions.
* **Interactive Breadcrumbs:** A clickable navigation bar at the top of every note (`> [[index|🏠 Hub]] > [[periodic/weekly_2026-W47|📅 Week 47]] > **Day Review**`) allows instant 1-click drill-up.
* **Native Markdown Tables:** Automatically renders clean tables with column alignment, hover states, and wikilink integration.

---

### Timeline Integration & Session Drawer
You can compile and interact with notes without ever leaving your workflow:
* **1-Click Period Note Button:** In the timeline header, click the dedicated button (**"Day Note"**, **"Week Note"**, or **"Month Note"**) to instantly synthesize the currently selected period into the Knowledge Vault and view it immediately.
* **Session Drawer (`TimelineSidebar`):** Click any activity node on your serpentine timeline:
  * **Activity Breakdown Tab:** View non-overlapping time slices, sub-events, domains, and durations.
  * **Session Note Tab:** Click to generate a structured markdown note.
  * **✨ Enrich with AI:** Summarize key breakthroughs and context using your local model.
  * **Inline Editor:** Edit markdown directly with a built-in monospace editor.
  * **Safe Deletion:** Move the note to the vault `.trash/` staging folder with a confirmation prompt.

---

### Knowledge Vault Explorer (`WikiVaultView`)
Click **"Knowledge Vault"** in the top navigation tab to enter the full-screen vault browser:
* **Category Filters:** 1-click filter pills (`All`, `Projects`, `Topics`, `Sessions`, `Periodic`, `Index / Log`) wrap neatly across rows with zero ugly horizontal scrollbars.
* **Periodic Sub-Filters:** Selecting `Periodic` unveils instant sub-filter pills: `[ All | ☀️ Day | 📅 Week | 🗓️ Month ]` to jump directly to the desired horizon.
* **Note Management:** Create new notes (`+ New Note`), search titles and content with real-time filtering, edit raw markdown, or clear/archive the vault safely to `.trash/`.
* **Flexible Width Sidepanels:** Drag the vertical divider bar (`cursor-col-resize`) to adjust the sidebar explorer width (220px–600px). Your custom width is automatically saved and remembered.
