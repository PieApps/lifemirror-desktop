# 📋 LifeMirror Desktop

LifeMirror Desktop is a privacy-first, local-focused productivity reflection utility. It captures continuous operating system activity logs and browser tab focus histories natively, records them securely in a local encrypted SQLCipher database, and visualizes your day as a beautiful serpentine "S-Curve" timeline infographic.

Additionally, LifeMirror interfaces with a locally running AI to compile daily mindfulness reflection cards entirely offline, ensuring no telemetry or analytical data leaves your host machine.

---

## 🚀 Quick Start

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

### 3. Set your Chrome Extension ID

Load the `companion-extension/` folder as an unpacked extension in Chrome (`chrome://extensions` → enable **Developer Mode** → **Load unpacked**), then copy the generated Extension ID.

Add it to a `.env` file in the project root (create it if it doesn't exist):

```
EXTENSION_ID=your32characterextensionid
```

You only need to do this **once**. When the extension is published to the Chrome Web Store, its ID becomes permanent and you can commit it to the template directly.

### 4. Install the Native Messaging Host

This one command works on **Windows, macOS, and Linux**:

```bash
npm run install-host
```

What it does:
- Reads `EXTENSION_ID` from `.env`
- Generates `companion-extension/com.lifemirror.desktop.json` from the template
- **Linux / macOS** — copies the manifest to the browser's `NativeMessagingHosts` folder
- **Windows** — copies the manifest and writes the required Windows Registry key automatically

> [!TIP]
> If you haven't added `EXTENSION_ID` to `.env`, the script will prompt you to enter it interactively.

### 5. Run the Development Server

```bash
npm run tauri dev
```

This compiles the Vite frontend and the Rust/Tauri backend in dev (debug) mode.

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

#### Step 6 — Set your Extension ID

Create a `.env` file in the project root:

```
EXTENSION_ID=your32characterextensionid
```

*(Find the ID at `chrome://extensions` → enable Developer Mode → load `companion-extension/` as unpacked → copy the ID shown)*

#### Step 7 — Build the app (once) so the binary exists

```powershell
npm run tauri dev
```
Wait until you see the app window open, then press `Ctrl+C` to stop it. This creates the `lifemirror.exe` binary used by the native host.

#### Step 8 — Install the native messaging host

```powershell
npm run install-host
```

This automatically:
- Generates the native host manifest with your extension ID
- Copies it to `%LOCALAPPDATA%\LifeMirror\NativeMessagingHosts\`
- Writes the registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.lifemirror.desktop`

> [!NOTE]
> If the registry step fails (rare), the script prints the exact `reg add` command to run manually. No administrator rights are required for `HKCU` registry keys.

#### Step 9 — Reload the extension

Go to `chrome://extensions`, find **LifeMirror Companion**, and click **↺ Reload**.

---

## ⚙️ Configuration Guides

### Browser Tab Tracking (Chrome Extension)

Browser tab sync operates over a secure, sandboxed stdin/stdout **Native Messaging** channel.

| Platform | After running `npm run install-host`, the manifest is placed at… |
|----------|------------------------------------------------------------------|
| **Windows** | `%LOCALAPPDATA%\LifeMirror\NativeMessagingHosts\com.lifemirror.desktop.json` |
| **macOS** | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` |
| **Linux** | `~/.config/google-chrome/NativeMessagingHosts/` |

The Windows Registry key is also written automatically:
```
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.lifemirror.desktop
```

### Pluggable Local AI (No Cloud APIs)

LifeMirror features an abstracted `InferenceProvider` allowing you to securely plug in local AI models without sending your timeline data to the cloud. Currently, **Ollama** is the default supported backend.

1. Download and run [Ollama](https://ollama.com) locally.
2. In the LifeMirror app, open **Settings** (top-right cog) and set:
   - **Local AI Endpoint**: `http://localhost:11434`
   - **Model**: e.g. `llama3.2`
3. Click **Download Model Native** to fetch the model without needing the terminal.

For detailed cross-OS setup and model management, see the [Ollama Configuration Guide](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md).

---

## 📦 Packaging & Distribution

LifeMirror uses Tauri's native bundler to create installers for each platform.

**Build for your current OS:**
```bash
npm run tauri build
```

Output goes to `src-tauri/target/release/bundle/`.

After building, install the native host pointing at the **release** binary:
```bash
npm run install-host:release
```

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
| [User Guide](file:///var/www/pieapps/lifemirror-desktop/docs/USER.md) | Initial installation, Chrome extension setup, and settings |
| [Ollama Setup](file:///var/www/pieapps/lifemirror-desktop/docs/OLLAMA_SETUP.md) | Model management and environment variable configuration |
| [Developer Docs](file:///var/www/pieapps/lifemirror-desktop/docs/DEVELOPER.md) | Database schemas, Wayland focus hooks, S-curve geometry, packaging |
| [Workflow Guide](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md) | Step-by-step instructions for safely implementing future changes |
