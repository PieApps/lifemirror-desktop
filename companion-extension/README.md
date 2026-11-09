# LifeMirror Desktop — Chrome Companion Extension

The official companion browser extension for [LifeMirror Desktop](https://pieapps.github.io/lifemirror-desktop.web/).

This extension provides **dual-mode on-device productivity reflection**:
1. **Standalone Mode (Zero-Config)**: Operates out-of-the-box inside Chrome without requiring any desktop software. Records active dwell time, context switches, smart intent tags, and page descriptions into local browser storage (`chrome.storage.local`) with a 48-hour rolling auto-pruning window. Includes a dedicated **Chrome Side Panel**, quick toolbar popup, and 1-click domain exclusion.
2. **Desktop Sync Mode**: When [LifeMirror Desktop](https://github.com/PieApps/lifemirror-desktop) is running, streams enriched tab metadata (title, URL, meta description, category tag, favicon, timestamp) over a sandboxed stdin/stdout Native Messaging channel into the local encrypted SQLCipher vault for OS-level timeline visualization and local Ollama AI reflection cards, maintaining bidirectional, offline-safe domain exclusion synchronization.

---

## 🛡️ Privacy, Domain Exclusion & URL Sanitization

LifeMirror is engineered with strict local-first privacy guarantees:
* **Domain Exclusion & Privacy Blacklist**: You can permanently exclude sensitive sites (banking, healthcare, private intranets, personal email). Excluded sites are **never recorded**—no dwell time, no titles, and no URLs are stored in browser storage or sent to the desktop app. Existing records can be purged in 1 click with options to delete past history from LifeMirror or block tracking from now on.
* **URL Sanitization**: Query strings (`?token=...`, `?session=...`) and hash fragments (`#...`) are stripped by default to prevent capturing reset tokens, session identifiers, or sensitive URL parameters.
* **Search Engine Query Masking**: Search queries for major search engines (Google, Bing, DuckDuckGo, Yahoo, Baidu, Yandex, Ecosia, Brave, Qwant, Startpage) are masked in page titles (e.g., `"Google Search"` instead of `"symptoms of X - Google Search"`).
* **Boundaries & Scope**: LifeMirror manages its own local records and does not touch Chrome's internal browsing history. External authentication providers (OAuth, SAML) and payment gateways redirect through independent domains and must be excluded separately.

---

## Directory Structure

```
companion-extension/
├── manifest.json                    # Manifest V3 extension configuration (SidePanel, Storage, Idle)
├── background.js                    # Background service worker (dwell time, idle detection, tags, native bridge)
├── domain-rules.js                  # Shared domain normalization, public-suffix validation & matching rules
├── content.js                       # Content script extracting page descriptions (<meta> / og:description)
├── sidepanel.html                   # Dedicated Chrome Side Panel reflection dashboard
├── sidepanel.css                    # Dark-mode side panel styles (heat-strip, progress bars, cards, drawer)
├── sidepanel.js                     # Side panel analytics renderer, category filters, 1-click revise & exclusion drawer
├── popup.html                       # Companion popup flyout UI (quick glance, side panel trigger & exclusion toggle)
├── popup.css                        # Cyber-zen dark mode popup styles
├── popup.js                         # Tab preview, meta reflection, 1-click revise, exclusion toggle & connection status
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


