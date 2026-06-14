# 📋 LifeMirror Desktop

LifeMirror Desktop is a privacy-first, local-focused productivity reflection utility. It captures continuous operating system activity logs and browser tab focus histories natively, records them securely in a local encrypted SQLCipher database, and visualizes your day as a beautiful serpentine "S-Curve" timeline infographic. 

Additionally, LifeMirror interfaces with a locally running AI (Ollama) to compile daily mindfulness reflection cards entirely offline, ensuring no telemetry or analytical data leaves your host machine.

---

## 🚀 Quick Start

### 1. Install Dependencies
Ensure you have Node.js and Rust installed, then install package dependencies:
```bash
npm install
```

### 2. Run the Development Server
This spins up the Vite frontend and compiles the Tauri 2.0 Rust core in dev mode:
```bash
npm run tauri dev
```

---

## ⚙️ Configuration Guides

Detailed configuration guides can be found in the documentation folder:

### 1. Browser Tab Tracking (Chrome Extension)
Browser tab sync operates over a secure, sandboxed stdin/stdout **Native Messaging** channel.
1. Load the `companion-extension/` directory as an unpacked extension in Chrome Developer settings (`chrome://extensions/`).
2. Register the native host manifest file `com.lifemirror.desktop.json` in your browser's registry directory.
   - **Linux**:
     ```bash
     mkdir -p ~/.config/google-chrome/NativeMessagingHosts
     ln -sf /var/www/pieapps/lifemirror-desktop/companion-extension/com.lifemirror.desktop.json ~/.config/google-chrome/NativeMessagingHosts/com.lifemirror.desktop.json
     ```
3. See [USER.md](file:///var/www/pieapps/lifemirror-desktop/docs/USER.md) for more details.

### 2. Local AI Integration (Ollama)
1. Download and run [Ollama](https://ollama.com) locally.
2. Pull your model of choice (e.g. `llama3.2` or `llama3`):
   ```bash
   ollama pull llama3.2
   ```
3. In the LifeMirror app, open settings (top-right cog) and specify the Ollama Host (`http://localhost:11434`) and model name.
4. For detailed cross-OS setup, environment variables, and model management, see the [Ollama Configuration Guide](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md).

---

## 📖 Documentation Directory
* [User Guide (`docs/USER.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/USER.md): Walks through initial installation, Chrome extension symlinking, and settings configurations.
* [Ollama Configuration Guide (`docs/OLLAMA_SETUP.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md): Detailed installation, model management, and environment variable configuration instructions for different operating systems.
* [Developer Documentation (`docs/DEVELOPER.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/DEVELOPER.md): Details database schemas, active Wayland focus hooks, S-curve geometry math, and packaging scripts.
* [Feature & Change Workflow (`docs/WORKFLOW.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md): Step-by-step instructions for developers and coding assistants to safely implement future changes.
