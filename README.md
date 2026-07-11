# 📋 LifeMirror Desktop

LifeMirror Desktop is a privacy-first, local-focused productivity reflection utility. It captures continuous operating system activity logs and browser tab focus histories natively, records them securely in a local encrypted SQLCipher database, and visualizes your day as a beautiful serpentine "S-Curve" timeline infographic. 

Additionally, LifeMirror interfaces with a locally running AI to compile daily mindfulness reflection cards entirely offline, ensuring no telemetry or analytical data leaves your host machine.

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

### Pluggable Local AI (No Cloud APIs)

LifeMirror features an abstracted `InferenceProvider` allowing you to securely plug in Local AI models without sending your timeline telemetry to the cloud. Currently, **Ollama** is the default supported backend.

1. Download and run [Ollama](https://ollama.com) locally.
2. In the LifeMirror app, open Settings (top-right cog) and specify the Local AI Endpoint (`http://localhost:11434`) and Text Generation Model (e.g., `llama3.2`).
3. Return to the dashboard and click the **Download Model Native** button to fetch the model without needing the terminal!

For detailed cross-OS setup, environment variables, and model management, see the [Ollama Configuration Guide](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md).

---

## 📦 Packaging & Distribution

LifeMirror uses Tauri's native bundler to easily create installation packages for Linux, Windows, and macOS. 

To build the package for your current operating system, simply run:
```bash
npm run tauri build
```
This process compiles the Vite frontend and the Rust backend in release mode. The resulting package will be output to `src-tauri/target/release/bundle/`.

### Platform Specifics

#### Linux (Debian/Ubuntu)
1. **Prerequisites:**
   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
   ```
2. **Output:** `src-tauri/target/release/bundle/deb/lifemirror_0.1.11_amd64.deb`
3. **Install:** `sudo apt install ./src-tauri/target/release/bundle/deb/lifemirror_0.1.11_amd64.deb`

#### Windows (.msi / .exe)
1. **Prerequisites:** 
   - [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (Usually pre-installed on Windows 11)
2. **Output:** `src-tauri\target\release\bundle\msi\lifemirror_0.1.11_x64_en-US.msi`

#### macOS (.dmg / .app)
1. **Prerequisites:** Xcode Command Line Tools (`xcode-select --install`)
2. **Output:** `src-tauri/target/release/bundle/dmg/lifemirror_0.1.11_x64.dmg`

---

## 📖 Documentation Directory
* [User Guide (`docs/USER.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/USER.md): Walks through initial installation, Chrome extension symlinking, and settings configurations.
* [Ollama Configuration Guide (`docs/OLLAMA_SETUP.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md): Detailed installation, model management, and environment variable configuration instructions for different operating systems.
* [Developer Documentation (`docs/DEVELOPER.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/DEVELOPER.md): Details database schemas, active Wayland focus hooks, S-curve geometry math, and packaging scripts.
* [Feature & Change Workflow (`docs/WORKFLOW.md`)](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md): Step-by-step instructions for developers and coding assistants to safely implement future changes.
