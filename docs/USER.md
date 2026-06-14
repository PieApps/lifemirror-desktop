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

## 3. Configuring Local AI (Ollama)

Ollama runs completely locally on your machine, ensuring your activity logs are never sent to external servers.

1. Download and install Ollama from [ollama.com](https://ollama.com).
2. Download your preferred model (e.g. `llama3.2` or `llama3`) in your terminal:
   ```bash
   ollama pull llama3.2
   ```
3. Open LifeMirror Desktop, click the **Settings** icon (top right), and configure:
   * **Ollama Server Endpoint:** `http://localhost:11434`
   * **Ollama Model:** `llama3.2`
4. Click **Reflect with Ollama** on the main dashboard to generate your daily reflection card!

---

## 4. Key Application Features

* **S-Curve Timeline:** Scroll through a winding serpentine infographic mapping your computer usage. Monitored active OS window sessions sit alongside browser tab events.
* **Timeline App Icons & Favicons:** The timeline automatically displays dynamic website favicons for web activities and custom brand-specific vector icons (VS Code, Discord, Slack, terminal, Spotify, Figma, etc.) for popular desktop applications.
* **Reflective Journaling:** Click "Reflect" on any timeline node to open a notes editor. Save your thoughts directly into the local encrypted SQLCipher database.
* **Incognito Mode:** Toggle Incognito Mode to temporarily freeze all active focus tracking and browser tab logging. While active, a glassmorphic blur and lock screen overlay are displayed to verify your privacy is isolated.
* **Background OS Tracking Control:** Turn background window monitoring on or off from the Local-First configurations panel. Toggling it off terminates active tracking loops and prevents database insertions.
* **Theme Selection:** Toggle between a deep neon-glow Dark Mode and a premium frosted-glass Light Mode using the Sun/Moon switcher button in the header. Preferences are automatically persisted across launches.
