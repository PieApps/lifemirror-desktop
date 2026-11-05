# LifeMirror Desktop — Chrome Companion Extension

The official companion browser extension for [LifeMirror Desktop](https://pieapps.github.io/lifemirror-desktop.web/).

This extension privately and safely captures the currently focused active web tab and sends metadata (URL, page title, favicon, timestamp) directly to the local LifeMirror Desktop application via Chrome Native Messaging (`com.lifemirror.desktop`).

---

## Directory Structure

```
companion-extension/
├── manifest.json                    # Manifest V3 extension configuration
├── background.js                    # Background service worker (Native Messaging bridge & context menus)
├── popup.html                       # Companion popup flyout UI
├── popup.css                        # Cyber-zen dark mode popup styles
├── popup.js                         # Tab preview, connection status & app launcher logic
├── icons/                           # Extension icon assets
│   ├── icon16.png                   # 16x16 icon (favicon / toolbar)
│   ├── icon48.png                   # 48x48 icon (extensions manager)
│   └── icon128.png                  # 128x128 icon (Chrome Web Store / install dialog)
├── com.lifemirror.desktop.json.template # Template for OS native messaging host manifest
├── com.lifemirror.desktop.json      # Generated native host descriptor (gitignored)
├── CHROMEWEBSTORE.md                # Chrome Web Store submission metadata and store copy
├── PRIVACY_POLICY.md                # Privacy policy documentation
├── CHANGELOG.md                     # Extension release notes and version history
└── README.md                        # This documentation file
```

---

## Development & Testing

1. Open Google Chrome (or Chromium / Brave / Edge) and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked** in the top-left corner and select this folder (`companion-extension`).
4. Note your 32-letter Extension ID (e.g. `hcpagmeofngagbmahpccoajilpndckab`).
5. Register the native messaging host with your extension ID:
   ```bash
   npm run install-host
   # or
   EXTENSION_ID=<your-extension-id> npm run install-host
   ```

---

## Creating the Distribution Archive (.zip)

To package the extension into a clean, ready-to-upload `.zip` archive for the Chrome Web Store:

```bash
# From the repository root:
npm run archive-extension

# Or directly using the script:
node scripts/archive-extension.mjs

# Or using the shell script:
./scripts/archive-extension.sh
```

The script automatically:
1. Validates `manifest.json` (syntax, Manifest V3 format, referenced assets).
2. Verifies that all icons (`icons/icon16.png`, etc.) and `background.js` exist.
3. Packages **strictly** runtime extension files (`manifest.json`, `background.js`, `popup.html`, `popup.css`, `popup.js`, `icons/`).
4. Excludes internal documentation, native messaging host templates, `.git`, `.DS_Store`, and dev artifacts.
5. Saves the output zip to `dist/lifemirror-desktop-v<version>.zip` (and `dist/lifemirror-desktop.zip`).

---

## Community & Social Links

- **Official Website**: [https://pieapps.github.io/lifemirror-desktop.web/](https://pieapps.github.io/lifemirror-desktop.web/)
- **YouTube**: [https://www.youtube.com/@pieapps](https://www.youtube.com/@pieapps)
- **X (Twitter)**: [https://x.com/pieapps](https://x.com/pieapps)
- **Facebook**: [https://www.facebook.com/vrpieapps](https://www.facebook.com/vrpieapps)
- **GitHub**: [https://github.com/PieApps/lifemirror-desktop](https://github.com/PieApps/lifemirror-desktop)


