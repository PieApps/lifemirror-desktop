# 🦙 Ollama Configuration & Installation Guide

This guide details how to install, configure, and manage **Ollama** on different operating systems (macOS, Windows, and Linux) to power **LifeMirror**'s local mindfulness reflection engine.

---

## 1. Installation by Operating System

### 🍎 macOS
1. **Direct Download:** Download the macOS zip file from [ollama.com/download](https://ollama.com/download/mac). Extract the app and drag it to your **Applications** folder.
2. **Via Homebrew:** (Alternative) Run the following in your terminal:
   ```bash
   brew install ollama
   ```
3. **Running Ollama:**
   - Launching the `Ollama.app` runs the server automatically and places a llama icon in your menu bar.
   - To check if it's active, open a terminal and run `ollama list`.

---

### 🪟 Windows
1. **Download Installer:** Download `OllamaSetup.exe` from [ollama.com/download](https://ollama.com/download/windows).
2. **Installation:** Run the installer. It will configure Ollama to start automatically when your system boots.
3. **Running Ollama:**
   - Look for the Ollama icon in your Windows Taskbar tray.
   - Open Command Prompt or PowerShell and verify with:
     ```cmd
     ollama --version
     ```

---

### 🐧 Linux
1. **One-Command Installation:** Open your terminal and run the official install script:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. **Managing the Service:** The installer registers Ollama with `systemd` automatically.
   - **Check service status:**
     ```bash
     sudo systemctl status ollama
     ```
   - **Start Ollama service:**
     ```bash
     sudo systemctl start ollama
     ```
   - **Stop Ollama service:**
     ```bash
     sudo systemctl stop ollama
     ```
   - **Enable service on startup (default):**
     ```bash
     sudo systemctl enable ollama
     ```

---

## 2. Managing Models for LifeMirror

## 2. Pulling the Language Model

Once Ollama is installed and running, you need to download (pull) a model. By default, LifeMirror uses **`llama3.2`** (a fast, lightweight 3-billion parameter model ideal for local summaries) and **`nomic-embed-text`** for semantic search.

> **💡 New in LifeMirror:** You no longer need to use the terminal to pull models! Simply open the LifeMirror Desktop application, and click the **Download Model Native** button on the dashboard to install the required models directly within the app.

If you prefer to use the terminal, you can pull the model manually:

* **Pull (Download) Model:**
  ```bash
  ollama pull llama3.2
  ```
* **Verify Downloaded Models:**
  ```bash
  ollama list
  ```
* **Test the Model in Terminal:**
  ```bash
  ollama run llama3.2
  ```
* **Remove a Model:**
  ```bash
  ollama rm llama3.2
  ```

> [!TIP]
> If you have a machine with lower RAM/no dedicated GPU, we recommend using smaller models like `llama3.2` (3B) or `qwen2.5:3b`. If your machine is powerful (16GB+ RAM, dedicated GPU), you can pull larger models like `llama3` (8B) or `mistral` (7B) for higher-quality reflections.

---

## 3. Environment Variables (Advanced Configuration)

Sometimes, you need to configure how Ollama listens on your network or resolve CORS errors. You can do this by setting environment variables:

| Variable | Purpose | Default | Example Value |
| :--- | :--- | :--- | :--- |
| `OLLAMA_HOST` | The IP/Port the Ollama server binds to. | `127.0.0.1:11434` | `0.0.0.0:11434` (listens on all network cards) |
| `OLLAMA_ORIGINS` | Allowed origins for HTTP requests (prevents browser CORS blocks). | Restrictive | `*` (allows connections from any webpage/app) |
| `OLLAMA_NUM_PARALLEL` | Number of parallel request streams to handle. | `1` | `2` |

### How to Set Environment Variables

#### 🍎 macOS (Application)
If running Ollama via the GUI application, you must set env variables before launching it:
1. Quit Ollama from the menu bar.
2. Launch Terminal and execute:
   ```bash
   launchctl setenv OLLAMA_HOST "127.0.0.1:11434"
   launchctl setenv OLLAMA_ORIGINS "*"
   ```
3. Relaunch the Ollama application.

#### 🪟 Windows
1. Quit Ollama from the system tray.
2. Open the **Start Menu** and search for **"Edit the system environment variables"**.
3. Click **Environment Variables** at the bottom.
4. Under **User variables** (or System variables), click **New...**:
   - Variable name: `OLLAMA_HOST` | Variable value: `127.0.0.1:11434`
   - Variable name: `OLLAMA_ORIGINS` | Variable value: `*`
5. Click **OK**, then restart your computer or restart the Ollama application.

#### 🐧 Linux (systemd)
If running Ollama as a systemd service:
1. Open the systemd service override config:
   ```bash
   sudo systemctl edit ollama.service
   ```
2. In the blank section that opens, enter the following configurations:
   ```ini
   [Service]
   Environment="OLLAMA_HOST=127.0.0.1:11434"
   Environment="OLLAMA_ORIGINS=*"
   ```
3. Save and close the editor (for `nano`, press `Ctrl+O`, `Enter`, `Ctrl+X`).
4. Reload systemd daemon and restart Ollama:
   ```bash
   sudo systemctl daemon-reload
   ```
   ```bash
   sudo systemctl restart ollama
   ```

---

## 4. Connecting Ollama to LifeMirror

1. Start **LifeMirror Desktop**.
2. Open settings by clicking the **Settings Gear Icon** ⚙️ in the top-right corner.
3. Configure the following inputs:
   - **Ollama Host URL:** `http://localhost:11434` (or your custom remote IP/port)
   - **Ollama Model:** `llama3.2` (or the specific model you pulled, e.g., `llama3`, `mistral`)
4. Close settings.
5. Click **Reflect with Ollama** on your dashboard.
