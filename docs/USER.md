# 🖥️ LifeMirror Desktop: User Guide

Welcome to LifeMirror Desktop! This privacy-first utility turns your raw daily activity logs into a beautiful serpentine scrollable timeline, giving you mindful daily summaries driven by a locally running AI model.

---

## 1. Prerequisites & Installation

To run LifeMirror Desktop locally, ensure you have Rust (Tauri 2.0 compiler core) and Node.js installed:

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

The browser extension syncs active tabs using Chrome's secure **Native Messaging API** instead of local WebSockets.

### Step A: Configure the Host Manifest
Edit the descriptor template file: `companion-extension/com.lifemirror.desktop.json`
* Change `"path"` to point to your compiled `lifemirror` binary (usually `/var/www/pieapps/lifemirror-desktop/src-tauri/target/debug/lifemirror`).
* Keep the configuration `"type": "stdio"`.

### Step B: Load the Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer Mode** (toggle in top right).
3. Click **Load unpacked** (top left) and select the `companion-extension/` directory.
4. Copy the newly generated **Extension ID** (e.g., `aagbofmjdgfcceidclhmdhmgmbpgeifn`).
5. Open `com.lifemirror.desktop.json` again and ensure your Extension ID is added to the `"allowed_origins"` array:
   ```json
   "allowed_origins": [
     "chrome-extension://<YOUR_EXTENSION_ID>/"
   ]
   ```

### Step C: Register the Native Host in your OS
Create a symlink or copy your host manifest JSON to your browser's NativeMessagingHosts folder.

* **Linux (Google Chrome)**:
  ```bash
  mkdir -p ~/.config/google-chrome/NativeMessagingHosts
  ln -sf /var/www/pieapps/lifemirror-desktop/companion-extension/com.lifemirror.desktop.json ~/.config/google-chrome/NativeMessagingHosts/com.lifemirror.desktop.json
  ```
* **Linux (Chromium)**:
  ```bash
  mkdir -p ~/.config/chromium/NativeMessagingHosts
  ln -sf /var/www/pieapps/lifemirror-desktop/companion-extension/com.lifemirror.desktop.json ~/.config/chromium/NativeMessagingHosts/com.lifemirror.desktop.json
  ```

---

## 3. Configuring Local AI

LifeMirror's AI features run completely locally on your machine, ensuring your activity logs are never sent to external servers.

1. Download and install a local inference provider. Currently, we recommend Ollama from [ollama.com](https://ollama.com) as the most stable engine.
2. Open LifeMirror Desktop and click the **Settings** icon (top right) to configure:
   * **Local AI Endpoint:** e.g., `http://localhost:11434`
   * **Text Generation Model:** e.g., `llama3.2`
3. If the model is not installed, LifeMirror provides a native **Download Model Native** button on the dashboard. Simply click it to download the model without ever touching a terminal!
4. Toggle between the **Reflect** and **Chat** modes in the AI panel on the right sidebar:
   - Click **Reflect with AI** to compile your daily focus logs into a 2-sentence mindfulness reflection card.
   - Select **Chat** to type custom queries and interact with the local AI regarding your log metrics or productivity details!

> For advanced configurations, environment variable setup, and detailed instructions for other operating systems, see the [Ollama Configuration Guide](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md).

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
* **System Tray Control & Close-to-Tray:** The application runs as a background utility. Closing the window with the 'X' button hides it to the system status tray rather than quitting. Single-click the tray icon to restore the window. Right-click the icon to toggle Incognito Mode, pause tracking, or completely Quit the app.
* **Launch on Startup:** A "Launch on Startup" toggle registers the application with the operating system to automatically start hidden in the system tray when your computer boots up.
* **Minimum Logging Threshold:** Customize the minimum time a window must be in focus (60 to 300 seconds, with a minimum of 1 minute) using a slider or input box to be recorded in the database, avoiding database bloat from quick clicks or window switches.
* **Deep Work Enforcement (Active Interdiction):** Transition from passive tracking to active focus defense. Define blacklisted keywords and regex rules in the Settings to instantly block distracting windows with a glassmorphic overlay. Take it a step further by setting an **Active Intention Goal** (e.g., "Writing a project proposal") on the main dashboard; the app will use your Local AI to asynchronously evaluate new windows on the fly and block anything that pulls you away from your active goal.
